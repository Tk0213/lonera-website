'use strict';

/**
 * Google Places adapter - OPENING HOURS ONLY.
 *
 * This is the licensed way to learn when a business is open, and it is worth
 * having: "open now" is useful even when we cannot see a single bookable slot.
 *
 * It is NOT a source of availability, and the shape of this module is meant to
 * make that hard to forget. Places returns regularOpeningHours; bookable slots
 * live behind the Maps Booking API, which is an interface for approved
 * scheduling aggregators to PUSH inventory INTO Google, not a way to pull it
 * out. Any code that treats an opening-hours window as a free slot is wrong,
 * so this adapter returns `openWindows` and never `slots`.
 *
 * Requires GOOGLE_PLACES_API_KEY. Without it the adapter reports unconfigured
 * and the resolver simply falls through to a lower tier.
 */

const FETCH_TIMEOUT_MS = 8000;
const ENDPOINT = 'https://places.googleapis.com/v1/places';

/**
 * Convert the API's weekday periods into windows for a given date.
 * `periods[].open.day` is 0=Sunday per the Places contract.
 */
function windowsForDate(periods, date) {
  if (!Array.isArray(periods)) return [];
  const day = date.getDay();
  const out = [];
  for (const p of periods) {
    if (!p || !p.open || p.open.day !== day) continue;
    const mk = (t) => {
      const d = new Date(date);
      d.setHours(t.hour || 0, t.minute || 0, 0, 0);
      return d.getTime();
    };
    const start = mk(p.open);
    // a missing close means open past midnight; clamp to end of day rather
    // than inventing a closing time
    const end = p.close ? mk(p.close) : new Date(date).setHours(23, 59, 59, 999);
    if (end > start) out.push([start, end]);
  }
  return out;
}

/**
 * Look up opening hours for a place id. Never throws.
 * @returns {{ok:boolean, openWindows?:Array, openNow?:boolean, error?:string}}
 */
async function fetchOpeningHours(placeId, { date = new Date(), fetchImpl = globalThis.fetch, apiKey = process.env.GOOGLE_PLACES_API_KEY } = {}) {
  if (!apiKey) return { ok: false, error: 'unconfigured', unconfigured: true };
  if (!placeId || !/^[\w-]{6,128}$/.test(placeId)) return { ok: false, error: 'bad place id' };

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${ENDPOINT}/${encodeURIComponent(placeId)}`, {
      signal: ctl.signal,
      headers: {
        'X-Goog-Api-Key': apiKey,
        // field mask keeps the bill down and states plainly what we read
        'X-Goog-FieldMask': 'regularOpeningHours,currentOpeningHours,utcOffsetMinutes',
      },
    });
    if (!res.ok) return { ok: false, error: `places returned ${res.status}` };
    const body = await res.json();
    const hours = body.currentOpeningHours || body.regularOpeningHours || {};
    return {
      ok: true,
      openNow: typeof hours.openNow === 'boolean' ? hours.openNow : undefined,
      openWindows: windowsForDate(hours.periods, date),
      fetchedAt: Date.now(),
    };
  } catch (err) {
    return { ok: false, error: err && err.name === 'AbortError' ? 'places timed out' : 'places unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchOpeningHours, windowsForDate };
