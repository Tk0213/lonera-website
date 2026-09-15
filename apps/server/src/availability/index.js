'use strict';

/**
 * Availability resolver.
 *
 * Picks the best source available for a business, turns it into slots, and
 * reports honestly which tier the answer came from. The ordering is fixed:
 *
 *   1. ICS feed      - real busy/free, the only source that can be called live
 *   2. Declared      - hours the provider typed in themselves
 *   3. Places hours  - licensed opening hours, never treated as free slots
 *   4. Nothing       - say so, and route the user to asking
 *
 * A failing source degrades to the next one. It never throws, and it never
 * promotes a guess: `bookable` is true only when a fresh calendar feed said so.
 */

const {
  tiers: { TIER, effectiveTier, isBookable },
  slots: { sliceFree, windowsFromDeclared },
} = require('@lonera/core');
const { fetchIcs } = require('./adapters/ics');
const { fetchOpeningHours } = require('./adapters/places');

const SLOT_MINUTES = 30;
const DEFAULT_HORIZON_DAYS = 7;
const CACHE_TTL_MS = 60 * 1000; // a minute: live enough to be true, long enough to not hammer feeds

const cache = new Map(); // bizId -> { at, payload }

function daysFrom(nowMs, n) {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const d = new Date(nowMs);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    out.push(d);
  }
  return out;
}

/**
 * Resolve availability for one business.
 *
 * @param {object} biz  { id, icsUrl?, declaredHours?, placeId? }
 * @param {object} opts { nowMs, horizonDays, fetchImpl, noCache }
 */
async function resolve(biz, opts = {}) {
  const nowMs = opts.nowMs || Date.now();
  const horizon = opts.horizonDays || DEFAULT_HORIZON_DAYS;
  const slotMs = SLOT_MINUTES * 60 * 1000;

  if (!biz || !biz.id) {
    return { tier: TIER.UNKNOWN, bookable: false, slots: [], sources: [], reason: 'no business' };
  }

  // Keyed by horizon too: a 1-day answer is not a 30-day answer. Keyed by id
  // alone, the first request's horizon was served back to every other one
  // for the next minute.
  const cacheKey = `${biz.id}|${horizon}`;
  const hit = !opts.noCache && cache.get(cacheKey);
  if (hit && nowMs - hit.at < CACHE_TTL_MS) return { ...hit.payload, cached: true };

  const days = daysFrom(nowMs, horizon);
  const sources = [];
  let tier = TIER.UNKNOWN;
  let slots = [];
  let fetchedAt = null;
  let openNow;

  // --- declared hours give us the frame the calendar is subtracted from ---
  let declaredWindows = [];
  if (biz.declaredHours) {
    declaredWindows = days.flatMap((d) => windowsFromDeclared(biz.declaredHours, d));
    if (declaredWindows.length) {
      sources.push({ kind: 'declared', ok: true });
      tier = TIER.DECLARED;
      slots = sliceFree(declaredWindows, [], slotMs, nowMs);
    }
  }

  // --- Places: opening hours only, used to frame or sanity-check, never as slots ---
  if (biz.placeId) {
    const res = await fetchOpeningHours(biz.placeId, { date: days[0], fetchImpl: opts.fetchImpl });
    sources.push({ kind: 'places', ok: res.ok, error: res.error, unconfigured: res.unconfigured });
    if (res.ok) {
      openNow = res.openNow;
      if (!declaredWindows.length && res.openWindows && res.openWindows.length) {
        // we know when they are open but not when they are free: that is
        // explicitly DECLARED, never CONNECTED
        declaredWindows = days.flatMap((d) => fetchOpeningHoursWindowsFor(res, d));
        tier = TIER.DECLARED;
        slots = sliceFree(res.openWindows, [], slotMs, nowMs);
      }
    }
  }

  // --- ICS: the only thing that earns "live" ---
  if (biz.icsUrl) {
    const res = await fetchIcs(biz.icsUrl, {
      windowStartMs: nowMs,
      windowEndMs: nowMs + horizon * 24 * 3600 * 1000,
      fetchImpl: opts.fetchImpl,
      resolver: opts.resolver,   // injectable DNS, so tests never touch the network
    });
    sources.push({ kind: 'ics', ok: res.ok, error: res.error, events: res.events, skipped: res.skipped });
    if (res.ok) {
      // a feed with no declared frame still needs one; assume nothing and use
      // the provider's declared hours, else a conservative 9-5
      const frame = declaredWindows.length
        ? declaredWindows
        : days.flatMap((d) => windowsFromDeclared({ [String(d.getDay())]: [['09:00', '17:00']] }, d));
      fetchedAt = res.fetchedAt;
      // Freshness is judged on the resolver's own clock, not the adapter's.
      // The adapter stamps Date.now(); a caller that supplies nowMs (a test,
      // or a replay) would otherwise see a mismatch between two clocks and
      // demote a perfectly live feed. Using the request's start time
      // understates age by the fetch duration, which is single-digit seconds
      // against a ten-minute window.
      tier = effectiveTier(TIER.CONNECTED, nowMs, nowMs);
      slots = sliceFree(frame, res.busy, slotMs, nowMs);
    }
  }

  const payload = {
    bizId: biz.id,
    tier,
    bookable: isBookable(tier),
    slots,
    slotMinutes: SLOT_MINUTES,
    openNow,
    fetchedAt,
    sources,
    /** Stated plainly so the UI never has to infer it. */
    reason:
      tier === TIER.CONNECTED ? 'calendar feed'
      : tier === TIER.DECLARED ? 'hours the business gave us, not live'
      : 'no schedule published anywhere we can read',
  };
  cache.set(cacheKey, { at: nowMs, payload });
  return payload;
}

/** Places windows for a later day, reusing the periods we already paid for. */
function fetchOpeningHoursWindowsFor(placesResult, date) {
  const { windowsForDate } = require('./adapters/places');
  return windowsForDate(placesResult.periods, date);
}

function clearCache() { cache.clear(); }

module.exports = { resolve, sliceFree, windowsFromDeclared, clearCache, TIER, SLOT_MINUTES };
