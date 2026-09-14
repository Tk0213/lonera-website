'use strict';

/**
 * iCalendar (.ics) adapter - the only source that yields genuinely live slots.
 *
 * Google Calendar, Outlook, Square, Jane and Calendly all expose a calendar as
 * an iCal URL. Asking a business for that one URL gets us real busy blocks with
 * no integration work on their side and no platform terms to breach, which is
 * why this is Tier 1 rather than scraping anything.
 *
 * Deliberately a small subset of RFC 5545: VEVENT, DTSTART/DTEND, RRULE with
 * FREQ=WEEKLY, and STATUS. A full iCal implementation is a library-sized
 * problem, and the fields above cover what a service business actually
 * publishes. Anything unparseable is skipped rather than guessed at, and a feed
 * whose events all fail to parse reports zero busy blocks rather than silently
 * reporting a free day.
 */

const MAX_BYTES = 2 * 1024 * 1024; // a service calendar is kilobytes; cap the blast radius
const FETCH_TIMEOUT_MS = 8000;

/** Unfold RFC 5545 line continuations (a leading space continues the line). */
function unfold(text) {
  return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
}

/**
 * Parse an iCal date-time. Handles `20260914T163000Z`, `20260914T163000`
 * (floating/local) and `20260914` (all-day). Returns epoch ms or null.
 */
function parseIcsDate(value) {
  if (!value) return null;
  const v = value.trim();
  let m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(v);
  if (m) {
    const [, y, mo, d, h, mi, s, z] = m;
    const args = [+y, +mo - 1, +d, +h, +mi, +s];
    return z === 'Z' ? Date.UTC(...args) : new Date(...args).getTime();
  }
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  return null;
}

/** Split a raw feed into VEVENT blocks of `KEY;PARAMS:VALUE` pairs. */
function parseEvents(raw) {
  const lines = unfold(raw).split(/\r?\n/);
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const idx = line.indexOf(':');
    if (idx < 1) continue;
    const rawKey = line.slice(0, idx);
    const key = rawKey.split(';')[0].toUpperCase();
    cur[key] = line.slice(idx + 1);
  }
  return events;
}

/**
 * Expand a weekly-recurring event across the window. Only FREQ=WEEKLY is
 * handled because that is what a business's working pattern actually is; other
 * frequencies fall back to the single occurrence rather than being invented.
 */
function expandWeekly(startMs, endMs, rrule, windowStartMs, windowEndMs) {
  const out = [];
  const dur = endMs - startMs;
  const freq = /FREQ=([A-Z]+)/.exec(rrule || '');
  if (!freq || freq[1] !== 'WEEKLY') {
    if (endMs > windowStartMs && startMs < windowEndMs) out.push([startMs, endMs]);
    return out;
  }
  const untilM = /UNTIL=([0-9TZ]+)/.exec(rrule);
  const until = untilM ? parseIcsDate(untilM[1]) : null;
  const countM = /COUNT=(\d+)/.exec(rrule);
  const maxCount = countM ? +countM[1] : Infinity;

  const WEEK = 7 * 24 * 3600 * 1000;
  let t = startMs;
  let n = 0;
  // wind forward to the window without looping over dead weeks
  if (t < windowStartMs) {
    const skip = Math.floor((windowStartMs - t) / WEEK);
    t += skip * WEEK;
    n += skip;
  }
  while (t < windowEndMs && n < maxCount) {
    if (until && t > until) break;
    if (t + dur > windowStartMs) out.push([t, t + dur]);
    t += WEEK;
    n += 1;
    if (out.length > 500) break; // a runaway RRULE must not become a runaway loop
  }
  return out;
}

/**
 * Turn a raw feed into merged busy intervals inside [windowStart, windowEnd].
 * Exported separately from the fetch so it can be tested without a network.
 */
function busyFromIcs(raw, windowStartMs, windowEndMs) {
  const events = parseEvents(String(raw).slice(0, MAX_BYTES));
  const busy = [];
  let skipped = 0;
  for (const ev of events) {
    const status = (ev.STATUS || '').toUpperCase();
    if (status === 'CANCELLED') continue;
    if ((ev.TRANSP || '').toUpperCase() === 'TRANSPARENT') continue; // marked free
    const s = parseIcsDate(ev.DTSTART);
    const e = parseIcsDate(ev.DTEND) || (s != null ? s + 3600 * 1000 : null);
    if (s == null || e == null || e <= s) { skipped += 1; continue; }
    busy.push(...expandWeekly(s, e, ev.RRULE, windowStartMs, windowEndMs));
  }
  busy.sort((a, b) => a[0] - b[0]);
  // merge overlaps so downstream slot maths sees one interval per busy period
  const merged = [];
  for (const iv of busy) {
    const last = merged[merged.length - 1];
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
    else merged.push([iv[0], iv[1]]);
  }
  return { busy: merged, events: events.length, skipped };
}

/**
 * Fetch and parse a calendar feed. Never throws: a source that is down must
 * degrade the business to a lower tier, not take down the request.
 */
async function fetchIcs(url, { windowStartMs, windowEndMs, fetchImpl = globalThis.fetch } = {}) {
  const started = Date.now();
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') {
      return { ok: false, error: 'ics feed must be https', fetchedAt: started };
    }
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
    let res;
    try {
      res = await fetchImpl(u.toString(), { signal: ctl.signal, redirect: 'follow' });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return { ok: false, error: `feed returned ${res.status}`, fetchedAt: started };
    const text = await res.text();
    if (!/BEGIN:VCALENDAR/i.test(text)) {
      return { ok: false, error: 'not an ical feed', fetchedAt: started };
    }
    const { busy, events, skipped } = busyFromIcs(text, windowStartMs, windowEndMs);
    return { ok: true, busy, events, skipped, fetchedAt: Date.now() };
  } catch (err) {
    const msg = err && err.name === 'AbortError' ? 'feed timed out' : 'feed unreachable';
    return { ok: false, error: msg, fetchedAt: started };
  }
}

module.exports = { fetchIcs, busyFromIcs, parseIcsDate, expandWeekly };
