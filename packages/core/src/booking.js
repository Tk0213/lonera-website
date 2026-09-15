/**
 * Reservations: hold, verify, confirm.
 *
 * The brief's rule is that availability shown to a user is never assumed to
 * still be true, and that two people must never end up in one slot. Both come
 * down to the same sequence:
 *
 *   hold      A short, exclusive claim taken the moment someone picks a time.
 *             Other people see the slot as unavailable immediately. The holder
 *             can take their time reading the confirmation screen without
 *             someone else booking it underneath them.
 *   verify    At confirm, ask the provider's live system whether the time is
 *             still free. Their own calendar may have changed since the
 *             availability was fetched - a walk-in, a phone booking, a
 *             holiday. This call is never answered from a cache.
 *   confirm   Only if the hold is still ours AND the provider said free, flip
 *             the reservation to confirmed in one step.
 *
 * The trap this is built around is the gap during `verify`. It is an await:
 * anything can happen while it runs, including the hold expiring. So after it
 * returns, every condition is checked again before writing. Checking before
 * the await and trusting that result afterwards is exactly how double
 * bookings happen.
 *
 * Failure is closed. If the provider cannot be reached, nothing is booked and
 * the hold is kept so the user can retry. Booking without verification because
 * the check timed out would turn every provider outage into double bookings.
 *
 * This module is the in-process reference implementation and it states its
 * limit plainly: it is correct inside one Node process. Across several it
 * needs the database to do the exclusion - see db/schema.sql, where the
 * `reservations` table carries an EXCLUDE constraint over (tutor, time range)
 * that makes an overlapping confirmed or held row impossible to insert,
 * regardless of how many servers race. The interface here is the same one the
 * Postgres store implements, and the tests run against it.
 */

export const HOLD_MS = 3 * 60 * 1000;
/** One person holding every Tuesday slot "just in case" starves everyone else. */
export const MAX_ACTIVE_HOLDS_PER_USER = 2;

const overlaps = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;

export function createReservationStore({
  clock = () => Date.now(),
  holdMs = HOLD_MS,
  maxHoldsPerUser = MAX_ACTIVE_HOLDS_PER_USER,
} = {}) {
  const rows = new Map();          // id -> reservation
  const byIdem = new Map();        // `${userId}:${key}` -> reservation id
  const inflight = new Map();      // `${userId}:${key}` -> Promise
  const listeners = new Set();
  let seq = 0;
  let version = 0;                 // bumps on every change; clients use it to detect gaps

  const emit = (type, r, extra = {}) => {
    version += 1;
    const event = {
      type, version, at: clock(),
      reservationId: r.id, tutorId: r.tutorId, start: r.start, end: r.end, ...extra,
    };
    for (const fn of listeners) { try { fn(event); } catch { /* a listener must not break a booking */ } }
    return event;
  };

  /** Expire stale holds. Called at the start of every operation, never lazily trusted. */
  function sweep() {
    const now = clock();
    for (const r of rows.values()) {
      if (r.status === 'held' && r.expiresAt <= now) {
        r.status = 'expired';
        r.version += 1;
        emit('slot.freed', r, { cause: 'hold_expired' });
      }
    }
  }

  function conflict(tutorId, start, end, ignoreId) {
    const now = clock();
    for (const r of rows.values()) {
      if (r.id === ignoreId || r.tutorId !== tutorId) continue;
      if (!overlaps(start, end, r.start, r.end)) continue;
      if (r.status === 'confirmed') return 'booked';
      if (r.status === 'held' && r.expiresAt > now) return 'held';
    }
    return null;
  }

  function hold({ tutorId, userId, start, end }) {
    sweep();
    const s = +new Date(start);
    const e = +new Date(end);
    if (!tutorId || !userId || !Number.isFinite(s) || !Number.isFinite(e) || !(e > s)) {
      return { ok: false, reason: 'invalid' };
    }
    if (s <= clock()) return { ok: false, reason: 'in_the_past' };

    // Picking the same time twice returns the same hold. It does not extend
    // it - otherwise re-tapping every 2m59s would hold a slot forever.
    for (const r of rows.values()) {
      if (r.status === 'held' && r.userId === userId && r.tutorId === tutorId
        && r.start === s && r.end === e && r.expiresAt > clock()) {
        return { ok: true, reservation: { ...r }, reused: true };
      }
    }

    const active = [...rows.values()].filter((r) => r.userId === userId && r.status === 'held').length;
    if (active >= maxHoldsPerUser) return { ok: false, reason: 'too_many_holds', max: maxHoldsPerUser };

    const why = conflict(tutorId, s, e, null);
    if (why) return { ok: false, reason: why === 'booked' ? 'taken' : 'held_by_someone_else' };

    seq += 1;
    const r = {
      id: `r${seq}`, tutorId, userId, start: s, end: e,
      status: 'held', expiresAt: clock() + holdMs, createdAt: clock(), version: 1,
    };
    rows.set(r.id, r);
    emit('slot.held', r);
    return { ok: true, reservation: { ...r } };
  }

  function release({ reservationId, userId }) {
    sweep();
    const r = rows.get(reservationId);
    if (!r || r.userId !== userId || r.status !== 'held') return { ok: false, reason: 'not_held' };
    r.status = 'released';
    r.version += 1;
    emit('slot.freed', r, { cause: 'released' });
    return { ok: true };
  }

  /**
   * @param {object} args
   * @param {string} args.reservationId
   * @param {string} args.userId
   * @param {string} args.idempotencyKey  the client generates one per confirm attempt
   * @param {function} args.verify  async ({tutorId,start,end}) => ({ free: boolean })
   */
  async function confirm({ reservationId, userId, idempotencyKey, verify }) {
    if (!idempotencyKey) return { ok: false, reason: 'idempotency_key_required' };
    const ik = `${userId}:${idempotencyKey}`;

    // A retried request after a dropped connection gets the original answer,
    // not a second booking and not a spurious "hold expired".
    if (byIdem.has(ik)) {
      // A key names one request. Reused for a different hold it is a client
      // bug, and answering "ok" with the other booking left this hold unbooked
      // while the user was told it had succeeded.
      if (byIdem.get(ik) !== reservationId) return { ok: false, reason: 'idempotency_key_reused' };
      const done = rows.get(byIdem.get(ik));
      return { ok: true, reservation: { ...done }, replayed: true };
    }
    if (inflight.has(ik)) {
      const pending = inflight.get(ik);
      if (pending.reservationId !== reservationId) return { ok: false, reason: 'idempotency_key_reused' };
      return pending.promise;
    }

    const run = (async () => {
      sweep();
      const r = rows.get(reservationId);
      if (!r || r.userId !== userId) return { ok: false, reason: 'not_found' };
      if (r.status === 'confirmed') return { ok: true, reservation: { ...r }, replayed: true };
      if (r.status !== 'held') return { ok: false, reason: 'hold_expired' };
      const heldVersion = r.version;

      let live;
      try {
        live = typeof verify === 'function'
          ? await verify({ tutorId: r.tutorId, start: r.start, end: r.end })
          : null;
      } catch {
        return { ok: false, reason: 'provider_unreachable', holdKept: true };
      }
      if (!live || typeof live.free !== 'boolean') {
        return { ok: false, reason: 'provider_unreachable', holdKept: true };
      }

      /* Everything below re-checks what was true before the await. */
      sweep();
      if (r.status === 'confirmed') {
        // Another confirm of this same hold - almost always a double tap - won
        // while this one waited on the provider. The booking exists and is this
        // user's, so this is a replay. It used to answer "hold expired", telling
        // someone their booking failed when it had succeeded.
        byIdem.set(ik, r.id);
        return { ok: true, reservation: { ...r }, replayed: true };
      }
      if (r.status !== 'held' || r.version !== heldVersion || r.expiresAt <= clock()) {
        return { ok: false, reason: 'hold_expired' };
      }
      if (!live.free) {
        r.status = 'released';
        r.version += 1;
        emit('slot.taken', r, { cause: 'taken_upstream' });
        return { ok: false, reason: 'taken_upstream' };
      }
      if (conflict(r.tutorId, r.start, r.end, r.id)) {
        // Unreachable while holds are exclusive; kept because this is the line
        // the database constraint enforces in production, and a store that
        // skipped it would pass these tests and fail there.
        return { ok: false, reason: 'taken' };
      }

      r.status = 'confirmed';
      r.confirmedAt = clock();
      r.version += 1;
      byIdem.set(ik, r.id);
      emit('booking.confirmed', r, { userId });
      return { ok: true, reservation: { ...r } };
    })();

    inflight.set(ik, { reservationId, promise: run });
    try { return await run; } finally { inflight.delete(ik); }
  }

  function cancel({ reservationId, userId, reason = 'user' }) {
    sweep();
    const r = rows.get(reservationId);
    if (!r || r.userId !== userId) return { ok: false, reason: 'not_found' };
    if (r.status !== 'confirmed') return { ok: false, reason: 'not_confirmed' };
    r.status = 'cancelled';
    r.cancelledAt = clock();
    r.version += 1;
    emit('booking.cancelled', r, { cause: reason, userId });
    emit('slot.freed', r, { cause: 'cancelled' });
    return { ok: true, reservation: { ...r } };
  }

  /**
   * Move a booking. The new time is confirmed first and the old one released
   * only after that succeeds, so a failed reschedule leaves the user with the
   * booking they had rather than with nothing.
   */
  async function reschedule({ fromId, toHoldId, userId, idempotencyKey, verify }) {
    const from = rows.get(fromId);
    if (!from || from.userId !== userId || from.status !== 'confirmed') {
      return { ok: false, reason: 'not_confirmed' };
    }
    const next = await confirm({ reservationId: toHoldId, userId, idempotencyKey, verify });
    if (!next.ok) return { ...next, kept: { ...from } };
    if (next.replayed && from.status === 'cancelled') return { ok: true, reservation: next.reservation, replayed: true };
    from.status = 'cancelled';
    from.cancelledAt = clock();
    from.replacedBy = next.reservation.id;
    from.version += 1;
    emit('booking.rescheduled', from, { to: next.reservation.id, userId });
    emit('slot.freed', from, { cause: 'rescheduled' });
    return { ok: true, reservation: next.reservation, replaced: { ...from } };
  }

  /** Busy intervals for a tutor: confirmed bookings and live holds. */
  function busy(tutorId) {
    sweep();
    const now = clock();
    return [...rows.values()]
      .filter((r) => r.tutorId === tutorId
        && (r.status === 'confirmed' || (r.status === 'held' && r.expiresAt > now)))
      .map((r) => [r.start, r.end, r.status]);
  }

  return {
    hold, release, confirm, cancel, reschedule, busy, sweep,
    get: (id) => (rows.has(id) ? { ...rows.get(id) } : null),
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    version: () => version,
  };
}
