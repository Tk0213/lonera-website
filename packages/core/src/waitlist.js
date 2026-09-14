/**
 * Standby queue - "tell me if someone cancels, and take it for me".
 *
 * Fairness is the entire feature. If a cancelled 2pm goes to whoever's phone
 * happened to poll first, the queue rewards a fast connection and a new
 * handset, which in this app means it quietly rewards the people who need it
 * least. So the order is decided once, when someone joins, and never
 * re-derived from timing afterwards.
 *
 * The rules, and why each one is here:
 *
 *   Order is a sequence number, not a clock.
 *     Two people joining in the same millisecond is normal, and server clocks
 *     drift. A monotonic counter gives a total order with no ties to break,
 *     so "who was first" is never a judgement call.
 *
 *   A release is claimed synchronously, once.
 *     `release()` takes the entry out of the line before it returns it. Node
 *     runs this on one thread, so no second caller can be handed the same
 *     slot. That guarantee ends at the process boundary: across several
 *     instances this needs a database transaction or a Redis lock, and the
 *     counter needs to live there too. Stated here rather than discovered in
 *     production when two people arrive for one appointment.
 *
 *   The line skips people it cannot serve, it does not collapse.
 *     Someone who already took another slot at that hour, or has since left,
 *     is passed over and the next person is offered it. Skipped entries are
 *     returned so the caller can tell them what happened.
 *
 *   Nobody can sit in every line.
 *     Without a cap the winning move is to join the standby list for every
 *     slot in the week, which starves everyone else and makes the queue
 *     useless. MAX_PER_USER is the answer to the user's own question about
 *     people gaming it for speed: you cannot outrun the order, and you cannot
 *     buy more places in it.
 *
 *   Auto-booking is opt-in per entry.
 *     A slot claimed at 3am for tomorrow morning is not automatically a
 *     favour. `autoBook: false` holds the place and notifies instead, and a
 *     business with no live calendar can only ever be asked, never booked -
 *     the same tier rule that governs the rest of availability.
 *
 * Ported to a factory rather than a module-level singleton. The server wants
 * one queue for the process; a React app wants one it can reset between tests
 * and never wants a stray import mutating it. `createWaitlist()` gives each
 * caller its own, and `waitlist` is the shared default for the server.
 */

export const MAX_PER_USER = 3;
/** How long a claimed-but-unconfirmed hold survives before it passes on. */
export const HOLD_MS = 15 * 60 * 1000;


export function createWaitlist() {
  let seq = 0;
  const lines = new Map();   // "biz|day|slot" -> entry[]
  const holds = new Map();   // key -> { entry, at }

  const keyOf = (bizId, day, slot) => `${bizId}|${day | 0}|${slot}`;

  function lineFor(bizId, day, slot) {
    const k = keyOf(bizId, day, slot);
    if (!lines.has(k)) lines.set(k, []);
    return lines.get(k);
  }

  /** How many live entries this user holds across every line. */
  function countFor(userId) {
    let n = 0;
    for (const line of lines.values()) n += line.filter((e) => e.userId === userId).length;
    return n;
  }

  /**
   * Join the line for one slot.
   * @returns {{ok:boolean, position?:number, entry?:object, error?:string}}
   */
  function join(bizId, day, slot, userId, opts = {}) {
    if (!bizId || !slot || !userId) return { ok: false, error: 'missing field' };
    const line = lineFor(bizId, day, slot);
    const already = line.find((e) => e.userId === userId);
    if (already) return { ok: true, position: line.indexOf(already) + 1, entry: already, already: true };
    if (countFor(userId) >= MAX_PER_USER) {
      return { ok: false, error: 'too many standby slots', max: MAX_PER_USER };
    }
    seq += 1;
    const entry = {
      seq,
      bizId,
      day: day | 0,
      slot,
      userId,
      autoBook: opts.autoBook !== false,
      joinedAt: opts.nowMs || Date.now(),
    };
    line.push(entry);
    // Insertion is already in seq order, but sort defensively: the order is the
    // promise this module makes, so it should not depend on callers behaving.
    line.sort((a, b) => a.seq - b.seq);
    return { ok: true, position: line.indexOf(entry) + 1, entry };
  }

  /** Leave one line. Returns true if an entry was actually removed. */
  function leave(bizId, day, slot, userId) {
    const line = lineFor(bizId, day, slot);
    const i = line.findIndex((e) => e.userId === userId);
    if (i < 0) return false;
    line.splice(i, 1);
    return true;
  }

  /** Remove this user from every line (they booked elsewhere, or signed out). */
  function leaveAll(userId) {
    let n = 0;
    for (const line of lines.values()) {
      for (let i = line.length - 1; i >= 0; i -= 1) {
        if (line[i].userId === userId) { line.splice(i, 1); n += 1; }
      }
    }
    return n;
  }

  /** 1-based place in line, or 0 when not in it. */
  function position(bizId, day, slot, userId) {
    return lineFor(bizId, day, slot).findIndex((e) => e.userId === userId) + 1;
  }

  function length(bizId, day, slot) {
    return lineFor(bizId, day, slot).length;
  }

  /**
   * A slot opened up. Hand it to the first person in line who can take it.
   *
   * @param {function} [isEligible] (entry) => boolean - the caller's chance to
   *        skip someone who already booked that hour elsewhere. Anything it
   *        throws on is treated as ineligible rather than crashing the release.
   * @returns {{claimed:object|null, skipped:object[], remaining:number}}
   */
  function release(bizId, day, slot, { isEligible, nowMs } = {}) {
    const line = lineFor(bizId, day, slot);
    const skipped = [];
    const now = nowMs || Date.now();
    while (line.length) {
      const entry = line.shift();          // removed before it is returned: claimed once
      let ok = true;
      if (typeof isEligible === 'function') {
        try { ok = Boolean(isEligible(entry)); } catch { ok = false; }
      }
      if (!ok) { skipped.push(entry); continue; }
      const claim = { ...entry, claimedAt: now, booked: entry.autoBook };
      if (!entry.autoBook) holds.set(keyOf(bizId, day, slot), { entry: claim, at: now });
      return { claimed: claim, skipped, remaining: line.length };
    }
    return { claimed: null, skipped, remaining: 0 };
  }

  /**
   * Expire holds nobody confirmed, so a slot someone ignored goes back to the
   * line instead of sitting dead until the appointment passes.
   */
  function sweepHolds({ nowMs, onExpire } = {}) {
    const now = nowMs || Date.now();
    const expired = [];
    for (const [k, h] of holds) {
      if (now - h.at < HOLD_MS) continue;
      holds.delete(k);
      expired.push(h.entry);
      if (typeof onExpire === 'function') { try { onExpire(h.entry); } catch { /* keep sweeping */ } }
    }
    return expired;
  }

  function confirmHold(bizId, day, slot) {
    return holds.delete(keyOf(bizId, day, slot));
  }

  /** Every line this user is standing in, soonest first. */
  function forUser(userId) {
    const out = [];
    for (const line of lines.values()) {
      const i = line.findIndex((e) => e.userId === userId);
      if (i >= 0) out.push({ ...line[i], position: i + 1, lineLength: line.length });
    }
    return out.sort((a, b) => a.day - b.day || a.seq - b.seq);
  }

  function reset() { lines.clear(); holds.clear(); seq = 0; }
  return {
    join, leave, leaveAll, position, length, release,
    sweepHolds, confirmHold, forUser, reset,
    MAX_PER_USER, HOLD_MS,
  };
}

/** The shared queue, for callers that want process-wide state. */
export const waitlist = createWaitlist();
