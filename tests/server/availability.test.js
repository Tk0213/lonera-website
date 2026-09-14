'use strict';

/**
 * Availability tests. Node's built-in runner, no test dependency added.
 *   node --test test/
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { busyFromIcs, expandWeekly, parseIcsDate } = require('../../apps/server/src/availability/adapters/ics');
const { windowsForDate } = require('../../apps/server/src/availability/adapters/places');
const { resolve, sliceFree, windowsFromDeclared, clearCache, TIER } = require('../../apps/server/src/availability');
const { effectiveTier, isBookable } = require('../../apps/server/src/availability/tiers');
const aiIntent = require('../../apps/server/src/ai/intent');

const H = 3600 * 1000;

function ics(body) {
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR\r\n`;
}

/* ------------------------------------------------------------------ ics parse */

test('parses a UTC datetime and an all-day date', () => {
  assert.equal(parseIcsDate('20260914T163000Z'), Date.UTC(2026, 8, 14, 16, 30, 0));
  assert.equal(parseIcsDate('20260914'), new Date(2026, 8, 14).getTime());
  assert.equal(parseIcsDate('nonsense'), null);
});

test('extracts a busy block from a single event', () => {
  const start = Date.UTC(2026, 8, 14, 16, 0);
  const { busy } = busyFromIcs(
    ics('BEGIN:VEVENT\r\nDTSTART:20260914T160000Z\r\nDTEND:20260914T170000Z\r\nEND:VEVENT'),
    start - 24 * H, start + 24 * H);
  assert.equal(busy.length, 1);
  assert.equal(busy[0][0], start);
  assert.equal(busy[0][1], start + H);
});

test('skips cancelled and transparent events', () => {
  const start = Date.UTC(2026, 8, 14, 16, 0);
  const { busy } = busyFromIcs(ics(
    'BEGIN:VEVENT\r\nDTSTART:20260914T160000Z\r\nDTEND:20260914T170000Z\r\nSTATUS:CANCELLED\r\nEND:VEVENT\r\n' +
    'BEGIN:VEVENT\r\nDTSTART:20260914T180000Z\r\nDTEND:20260914T190000Z\r\nTRANSP:TRANSPARENT\r\nEND:VEVENT'
  ), start - 24 * H, start + 24 * H);
  assert.equal(busy.length, 0, 'a cancelled or free-marked event is not busy');
});

test('merges overlapping events into one busy interval', () => {
  const start = Date.UTC(2026, 8, 14, 16, 0);
  const { busy } = busyFromIcs(ics(
    'BEGIN:VEVENT\r\nDTSTART:20260914T160000Z\r\nDTEND:20260914T173000Z\r\nEND:VEVENT\r\n' +
    'BEGIN:VEVENT\r\nDTSTART:20260914T170000Z\r\nDTEND:20260914T180000Z\r\nEND:VEVENT'
  ), start - 24 * H, start + 24 * H);
  assert.equal(busy.length, 1);
  assert.equal(busy[0][1], Date.UTC(2026, 8, 14, 18, 0));
});

test('counts unparseable events as skipped rather than free', () => {
  const start = Date.UTC(2026, 8, 14, 16, 0);
  const out = busyFromIcs(ics('BEGIN:VEVENT\r\nDTSTART:garbage\r\nEND:VEVENT'), start - 24 * H, start + 24 * H);
  assert.equal(out.busy.length, 0);
  assert.equal(out.skipped, 1, 'a broken event must be reported, not silently dropped');
});

test('a runaway RRULE cannot loop forever', () => {
  const s = Date.UTC(2026, 0, 1, 9, 0);
  const occurrences = expandWeekly(s, s + H, 'FREQ=WEEKLY', s, s + 1000 * 7 * 24 * H);
  assert.ok(occurrences.length <= 501, `bounded, got ${occurrences.length}`);
});

test('weekly recurrence respects UNTIL', () => {
  const s = Date.UTC(2026, 8, 7, 9, 0);
  const out = expandWeekly(s, s + H, 'FREQ=WEEKLY;UNTIL=20260922T000000Z', s, s + 60 * 24 * H);
  assert.equal(out.length, 3, 'Sep 7, 14, 21');
});

/* ------------------------------------------------------------------ slot math */

test('busy time removes exactly the colliding slots', () => {
  const day = new Date(2026, 8, 14); day.setHours(0, 0, 0, 0);
  const open = windowsFromDeclared({ 1: [['09:00', '12:00']] }, day); // Monday
  assert.equal(open.length, 1);
  const nine = open[0][0];
  const free = sliceFree(open, [[nine + H, nine + 2 * H]], 30 * 60 * 1000, nine - H);
  // 09:00-12:00 is six 30m slots; 10:00-11:00 removes two
  assert.equal(free.length, 4);
  assert.ok(!free.includes(nine + H), '10:00 is taken');
  assert.ok(free.includes(nine + 2 * H), '11:00 is free again');
});

test('slots in the past are never offered', () => {
  const day = new Date(2026, 8, 14); day.setHours(0, 0, 0, 0);
  const open = windowsFromDeclared({ 1: [['09:00', '12:00']] }, day);
  const nine = open[0][0];
  const free = sliceFree(open, [], 30 * 60 * 1000, nine + 90 * 60 * 1000); // "now" is 10:30
  assert.ok(free.every((t) => t >= nine + 90 * 60 * 1000));
});

test('malformed declared hours yield no windows rather than throwing', () => {
  const day = new Date(2026, 8, 14);
  assert.deepEqual(windowsFromDeclared({ 1: [['9am', 'noon']] }, day), []);
  assert.deepEqual(windowsFromDeclared({ 1: 'nope' }, day), []);
  assert.deepEqual(windowsFromDeclared(null, day), []);
});

/* ---------------------------------------------------------------------- tiers */

test('only a connected feed is bookable', () => {
  assert.equal(isBookable(TIER.CONNECTED), true);
  assert.equal(isBookable(TIER.DECLARED), false);
  assert.equal(isBookable(TIER.UNKNOWN), false);
});

test('a stale feed is demoted out of connected', () => {
  const now = Date.now();
  assert.equal(effectiveTier(TIER.CONNECTED, now - 30_000, now), TIER.CONNECTED);
  assert.equal(effectiveTier(TIER.CONNECTED, now - 3_600_000, now), TIER.DECLARED,
    'an hour-old calendar is not live data');
  assert.equal(effectiveTier(TIER.CONNECTED, null, now), TIER.DECLARED);
});

/* ------------------------------------------------------------------- resolver */

test('no schedule anywhere resolves to unknown, not to a guess', async () => {
  clearCache();
  const out = await resolve({ id: 'nodata' }, { noCache: true });
  assert.equal(out.tier, TIER.UNKNOWN);
  assert.equal(out.bookable, false);
  assert.equal(out.slots.length, 0);
  assert.match(out.reason, /no schedule published/);
});

test('declared hours give slots but never bookable', async () => {
  clearCache();
  const out = await resolve({ id: 'declared', declaredHours: { 1: [['09:00', '17:00']] } }, { noCache: true });
  assert.equal(out.tier, TIER.DECLARED);
  assert.equal(out.bookable, false, 'declared hours must not be instantly bookable');
  assert.match(out.reason, /not live/);
});

test('a live feed produces bookable slots with the busy time removed', async () => {
  clearCache();
  const now = new Date(2026, 8, 14, 8, 0).getTime(); // Monday 08:00 local
  const busyStart = new Date(2026, 8, 14, 10, 0).getTime();
  const pad = (n) => String(n).padStart(2, '0');
  const local = (ms) => { const d = new Date(ms);
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`; };
  const feed = ics(`BEGIN:VEVENT\r\nDTSTART:${local(busyStart)}\r\nDTEND:${local(busyStart + H)}\r\nEND:VEVENT`);
  const fakeFetch = async () => ({ ok: true, status: 200, text: async () => feed });

  const out = await resolve(
    { id: 'live', icsUrl: 'https://example.com/cal.ics', declaredHours: { 1: [['09:00', '12:00']] } },
    { nowMs: now, horizonDays: 1, fetchImpl: fakeFetch, noCache: true });

  assert.equal(out.tier, TIER.CONNECTED);
  assert.equal(out.bookable, true);
  assert.ok(!out.slots.includes(busyStart), '10:00 is busy in the feed');
  assert.ok(out.slots.includes(new Date(2026, 8, 14, 11, 0).getTime()), '11:00 survives');
});

test('an unreachable feed degrades to declared instead of failing the request', async () => {
  clearCache();
  const boom = async () => { throw new Error('network down'); };
  const out = await resolve(
    { id: 'degraded', icsUrl: 'https://example.com/cal.ics', declaredHours: { 1: [['09:00', '17:00']] } },
    { fetchImpl: boom, noCache: true });
  assert.equal(out.tier, TIER.DECLARED);
  assert.equal(out.bookable, false);
  assert.ok(out.sources.some((s) => s.kind === 'ics' && !s.ok), 'the failure is reported, not hidden');
});

test('a non-https feed is refused', async () => {
  clearCache();
  const out = await resolve({ id: 'insecure', icsUrl: 'http://example.com/cal.ics' }, { noCache: true });
  assert.ok(out.sources.some((s) => s.kind === 'ics' && /https/.test(s.error || '')));
  assert.equal(out.bookable, false);
});

/* -------------------------------------------------------------------- places */

test('places periods become windows only for the matching weekday', () => {
  const monday = new Date(2026, 8, 14); // a Monday, getDay() === 1
  const periods = [{ open: { day: 1, hour: 9, minute: 0 }, close: { day: 1, hour: 17, minute: 0 } },
                   { open: { day: 2, hour: 9, minute: 0 }, close: { day: 2, hour: 17, minute: 0 } }];
  const w = windowsForDate(periods, monday);
  assert.equal(w.length, 1, 'only Monday');
});

/* ------------------------------------------------------------------ ai intent */

test('a hallucinated service is dropped, not passed through', () => {
  // Roofing is deliberately not a Lonera category. Plumbing used to stand in
  // here and became real when the planner shipped, so the test was asserting
  // the opposite of its own name until the category list was checked.
  const out = aiIntent.sanitize({ service: 'Roofing', language: 'Korean', action: 'book' });
  assert.equal(out.service, null, 'Roofing is not one of our categories');
  assert.deepEqual(out.services, []);
  assert.equal(out.language, 'Korean');
  assert.equal(out.action, 'book');
});

test('every service in a multi-trade request survives, in order', () => {
  const out = aiIntent.sanitize({ services: ['Plumbing', 'Cleaning', 'Electrical'], language: 'Korean' });
  assert.deepEqual(out.services, ['Plumbing', 'Cleaning', 'Electrical']);
  assert.equal(out.service, 'Plumbing', 'the first is still exposed for single-service callers');
});

test('a service list is cleaned without losing the valid entries', () => {
  const out = aiIntent.sanitize({ services: ['Plumbing', 'Roofing', 'Plumbing', 'Hair', 'Auto', 'Taxes', 'Dental'] });
  assert.deepEqual(out.services, ['Plumbing', 'Hair', 'Auto', 'Taxes'],
    'invented dropped, duplicate collapsed, capped at four');
});

test('a non-array services field does not throw or leak', () => {
  assert.deepEqual(aiIntent.sanitize({ services: 'Plumbing; DROP TABLE' }).services, []);
  assert.deepEqual(aiIntent.sanitize({ services: [null, 7, {}] }).services, []);
});

test('an unknown action falls back to find', () => {
  assert.equal(aiIntent.sanitize({ action: 'launch_missiles' }).action, 'find');
});

test('json parsing survives a code fence', () => {
  const v = aiIntent.parseJsonish('```json\n{"service":"Dental"}\n```');
  assert.deepEqual(v, { service: 'Dental' });
});

test('angle brackets are stripped from free text', () => {
  const out = aiIntent.sanitize({ action: 'find', whenText: '<img src=x onerror=alert(1)>' });
  assert.ok(!/[<>]/.test(out.whenText || ''), 'no markup survives into the app');
});

test('intent parsing reports fallback when no provider is configured', async () => {
  const out = await aiIntent.parse('find a korean dentist', {
    fetchImpl: async () => { throw new Error('should not be called'); },
  });
  // no keys in the test env, so every provider is skipped
  assert.equal(out.ok, false);
  assert.equal(out.fallback, true);
});
