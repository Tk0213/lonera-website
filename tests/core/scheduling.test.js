'use strict';

/**
 * Smart scheduling tests.
 *
 * Every numbered example in the scheduling brief is pinned here as a test,
 * using the brief's own sentences and its own expected orderings. If a weight
 * changes and an example stops ranking the way the brief says it should, this
 * file names the example.
 *
 * Dates: Monday 14 September 2026 is "now". Tuesday is the 15th, Thursday the
 * 17th, Friday the 18th.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { parseTutoringRequest, refine } = require('../../packages/core/src/tutoring.js');
const { rank, evaluate, swapCandidates, groupByTutor, diffRankings } = require('../../packages/core/src/matching.js');
const { createReservationStore } = require('../../packages/core/src/booking.js');
const cal = require('../../packages/core/src/calendar.js');

const NOW = new Date(2026, 8, 14, 9, 0).getTime();          // Mon 09:00
const at = (day, h, m = 0) => new Date(2026, 8, day, h, m); // day of September
let n = 0;
const slot = (tutor, day, h, m = 0, mins = 60) => ({
  id: `s${++n}`, tutor, start: at(day, h, m), end: new Date(+at(day, h, m) + mins * 60000), status: 'open',
});
const label = (m) => {
  const d = new Date(m.slot.start);
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  return `${m.slot.tutor.id} ${day} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const calc = { id: 'calc', subjects: ['calculus'], purposes: ['exam_prep'], rating: 4.6, languages: ['English'] };
const organic = { id: 'organic', subjects: ['organic_chemistry'], rating: 4.7 };
const chem = { id: 'chem', subjects: ['chemistry'], rating: 4.7 };
const science = { id: 'science', subjects: ['science'], rating: 4.7 };
const maths = { id: 'maths', subjects: ['math'], rating: 4.9 };

/* ================================================================ 3. intent */

test('3. the calculus sentence becomes structured preferences', () => {
  const p = parseTutoringRequest(
    'I need a calculus tutor for Tuesday evening, preferably someone who can help me prepare for an exam.');
  assert.equal(p.service, 'Tutoring');
  assert.equal(p.subject, 'calculus');
  assert.equal(p.purpose, 'exam_prep');
  const byType = Object.fromEntries(p.constraints.map((c) => [c.type, c]));
  assert.deepEqual(byType.days.value, [2], 'Tuesday');
  assert.equal(byType.window.label, 'evening');
  assert.equal(byType.subject.kind, 'hard', 'a tutor who does not teach calculus cannot be offered at all');
  assert.equal(byType.purpose.kind, 'soft', '"preferably" makes exam prep a preference');
});

test('3. a general request stays general', () => {
  const p = parseTutoringRequest('I need a tutor');
  assert.equal(p.service, 'Tutoring');
  assert.equal(p.subject, null);
  assert.equal(p.constraints.length, 0, 'nothing invented');
});

test('3. Korean requests reach the same structure', () => {
  const p = parseTutoringRequest('화요일 저녁 7시 미적분 과외, 시험 준비');
  assert.equal(p.subject, 'calculus');
  assert.equal(p.purpose, 'exam_prep');
  const target = p.constraints.find((c) => c.type === 'target');
  assert.equal(target.value, 19 * 60, '저녁 7시 is 19:00');
});

test('3. numbers that are not times are not read as times', () => {
  const p = parseTutoringRequest('grade 11 physics tutor, 2 hours, thursday');
  assert.ok(!p.constraints.some((c) => ['target', 'notBefore', 'notAfter'].includes(c.type)));
  assert.equal(p.level, 'grade 11');
  assert.equal(p.durationMin, 120);
});

/* ======================================================= 8. hard vs soft */

test('8. "only Tuesday or Thursday" is hard; the specialist is a preference', () => {
  const p = parseTutoringRequest(
    "I can only do Tuesday or Thursday, and I'd prefer someone who specializes in organic chemistry.");
  const byType = Object.fromEntries(p.constraints.map((c) => [c.type, c]));
  assert.equal(byType.days.kind, 'hard');
  assert.deepEqual(byType.days.value, [2, 4]);
  assert.equal(byType.subject.value, 'chemistry', 'they still need a chemistry tutor');
  assert.equal(byType.subject.kind, 'hard');
  assert.equal(byType.specialty.value, 'organic_chemistry');
  assert.equal(byType.specialty.kind, 'soft', 'a specialty they prefer must not filter out every general chemistry tutor');
});

test('8. a hard day is never traded for a better score', () => {
  const p = parseTutoringRequest(
    "I can only do Tuesday or Thursday, and I'd prefer someone who specializes in organic chemistry.");
  const slots = [
    slot(organic, 16, 17),    // Wednesday: the perfect specialist, on a forbidden day
    slot(chem, 17, 17),       // Thursday: a general chemistry tutor
  ];
  const { matches, excluded } = rank(slots, p, { now: NOW });
  assert.deepEqual(matches.map(label), ['chem Thu 17:00']);
  assert.equal(excluded.day, 1);
});

/* ================================================= 6. alternative times */

test('6. an unavailable 6:00 PM falls back to the closest times, earlier first on a tie', () => {
  const p = parseTutoringRequest('I want a calculus tutor Tuesday at 6:00 PM.');
  const slots = [
    slot(calc, 15, 14),       // same day, far
    slot(calc, 15, 19),       // 7:00 PM
    slot(calc, 15, 18, 30),   // 6:30 PM
    slot(calc, 16, 18),       // Wednesday at exactly 6
    slot(calc, 15, 17, 30),   // 5:30 PM
  ];                          // no 6:00 PM on Tuesday: it is taken
  const ranked = rank(slots, p, { now: NOW }).matches.map(label);
  assert.deepEqual(ranked.slice(0, 3), ['calc Tue 17:30', 'calc Tue 18:30', 'calc Tue 19:00'],
    'the brief\'s own order: 5:30, 6:30, 7:00');
  assert.ok(ranked.indexOf('calc Tue 14:00') < ranked.indexOf('calc Wed 18:00'),
    'same day ranks above a nearby day');
});

test('6. "absolutely cannot after 7" removes later times even when they are closer', () => {
  const p = parseTutoringRequest('calculus tutor tuesday at 6pm, I absolutely cannot attend after 7:00 PM');
  const slots = [slot(calc, 15, 17, 30), slot(calc, 15, 18, 30), slot(calc, 15, 19), slot(calc, 15, 20)];
  const { matches, excluded } = rank(slots, p, { now: NOW });
  assert.deepEqual(matches.map(label), ['calc Tue 17:30'],
    'a one-hour 6:30 ends at 7:30, so it breaks the limit too');
  assert.equal(excluded.too_late, 3);
});

test('6. the exact requested time, when free, is first', () => {
  const p = parseTutoringRequest('I want a calculus tutor Tuesday at 6:00 PM.');
  const slots = [slot(calc, 15, 17, 30), slot(calc, 15, 18), slot(calc, 15, 18, 30)];
  const top = rank(slots, p, { now: NOW }).matches[0];
  assert.equal(label(top), 'calc Tue 18:00');
  assert.ok(top.reasons.some((r) => r.code === 'exact_time'));
});

/* ============================================= 7. "what's available?" */

test("7. \"what's available?\" keeps the earlier request and ranks it as the brief orders", () => {
  const first = parseTutoringRequest(
    'I need a chemistry tutor for Thursday after 5 PM, preferably someone experienced with organic chemistry.');
  const ctx = refine(first, "What's available?");
  assert.deepEqual(ctx.constraints, first.constraints, 'not a new search');
  assert.equal(ctx.browse, true);

  const slots = [
    slot(science, 17, 18),        // general science, Thursday evening
    slot(chem, 18, 17, 30),       // chemistry, Friday 5:30
    slot(organic, 17, 18, 30),    // organic, Thursday 6:30
    slot(chem, 17, 17),           // chemistry, Thursday 5:00
    slot(organic, 17, 17, 30),    // organic, Thursday 5:30
    slot(maths, 17, 17, 30),      // maths - no chemistry at all
  ];
  const { matches, excluded } = rank(slots, ctx, { now: NOW });
  assert.deepEqual(matches.map(label), [
    'organic Thu 17:30',
    'organic Thu 18:30',
    'chem Thu 17:00',
    'chem Fri 17:30',
    'science Thu 18:00',
  ], 'the brief\'s ranking, in the brief\'s order');
  assert.equal(excluded.subject, 1, 'the maths tutor is filtered, not ranked last');
});

test('7. a follow-up that names something new changes only that thing', () => {
  const first = parseTutoringRequest('chemistry tutor thursday after 5 pm');
  const moved = refine(first, 'actually make it Friday');
  const byType = Object.fromEntries(moved.constraints.map((c) => [c.type, c.value]));
  assert.deepEqual(byType.days, [5]);
  assert.equal(byType.notBefore, 17 * 60, 'the time limit survives');
  assert.equal(byType.subject, 'chemistry', 'the subject survives');
  const also = refine(first, 'also Tuesday');
  assert.deepEqual(also.constraints.find((c) => c.type === 'days').value, [2, 4], '"also" adds a day');
});

/* ==================================================== structural filters */

test("the user's own calendar is a hard constraint", () => {
  const p = parseTutoringRequest('calculus tutor tuesday evening');
  const slots = [slot(calc, 15, 17), slot(calc, 15, 19)];
  const busy = [[at(15, 16, 30), at(15, 18)]];      // a dentist appointment
  const { matches, excluded } = rank(slots, p, { now: NOW, userBusy: busy });
  assert.deepEqual(matches.map(label), ['calc Tue 19:00']);
  assert.equal(excluded.your_calendar, 1);
});

test('a slot starting too soon to reach is never offered', () => {
  const p = parseTutoringRequest('calculus tutor');
  const soon = slot(calc, 14, 10);                  // an hour from "now"
  assert.equal(evaluate(soon, p, { now: NOW }).ok, false);
});

test('a slot that is no longer open is never ranked', () => {
  const p = parseTutoringRequest('calculus tutor');
  const s = { ...slot(calc, 15, 17), status: 'held' };
  assert.equal(rank([s], p, { now: NOW }).matches.length, 0);
});

test('when nothing fits, it says which hard constraint to loosen - and does not loosen it', () => {
  const p = parseTutoringRequest('calculus tutor, I can only do mondays');
  const slots = [slot(calc, 15, 17), slot(calc, 16, 17)];
  const out = rank(slots, p, { now: NOW });
  assert.equal(out.matches.length, 0);
  assert.equal(out.relaxations[0].constraint.type, 'days');
  assert.equal(out.relaxations[0].wouldReveal, 2);
});

/* ================================================================ 2. swap */

test('2. swap keeps the original request and ranks alternatives around the current booking', () => {
  const p = parseTutoringRequest('I can only do Tuesday or Thursday, chemistry tutor, prefer organic chemistry');
  const current = { tutorId: 'chem', start: at(17, 17), end: at(17, 18) };
  const slots = [
    slot(chem, 17, 17),           // the booking itself
    slot(chem, 17, 18),           // same tutor, an hour later
    slot(organic, 17, 17, 30),    // specialist, close by
    slot(organic, 16, 17),        // specialist on a forbidden Wednesday
    slot(science, 15, 17),        // generalist on Tuesday
  ];
  const out = swapCandidates(slots, p, current, { now: NOW });
  const ids = out.matches.map(label);
  assert.ok(!ids.includes('chem Thu 17:00'), 'the current booking is not its own alternative');
  assert.ok(!ids.includes('organic Wed 17:00'), 'the hard day survives into swap');
  assert.equal(ids[0], 'organic Thu 17:30', 'the specialist near the current time leads');
  assert.ok(out.matches.find((m) => label(m) === 'chem Thu 18:00').sameTutor);
  assert.equal(groupByTutor(out.matches).length, 3, 'one card per tutor');
});

test('results that change underneath the user are reported as changes', () => {
  const a = [{ slot: { id: 'x' } }, { slot: { id: 'y' } }, { slot: { id: 'z' } }];
  const b = [{ slot: { id: 'z' } }, { slot: { id: 'x' } }, { slot: { id: 'w' } }];
  const d = diffRankings(a, b);
  assert.deepEqual(d.removed, ['y']);
  assert.deepEqual(d.added, ['w']);
  assert.ok(d.moved.some((m) => m.id === 'z' && m.to === 0));
});

/* ===================================================== 5. double booking */

function store(start = NOW) {
  let t = start;
  const s = createReservationStore({ clock: () => t });
  return { s, advance: (ms) => { t += ms; } };
}
const free = async () => ({ free: true });
const five = { tutorId: 'calc', start: +at(15, 17), end: +at(15, 18) };

test('5. User A confirms 5:00 PM; User B can never book it', async () => {
  const { s } = store();
  const a = s.hold({ ...five, userId: 'A' });
  assert.equal(a.ok, true);
  const bTries = s.hold({ ...five, userId: 'B' });
  assert.equal(bTries.ok, false, 'unavailable to B the moment A picks it');
  assert.equal(bTries.reason, 'held_by_someone_else');

  const confirmed = await s.confirm({ reservationId: a.reservation.id, userId: 'A', idempotencyKey: 'k1', verify: free });
  assert.equal(confirmed.ok, true);
  assert.equal(s.hold({ ...five, userId: 'B' }).reason, 'taken');
});

test('5. an overlapping half-hour is as taken as the exact slot', async () => {
  const { s } = store();
  const a = s.hold({ ...five, userId: 'A' });
  await s.confirm({ reservationId: a.reservation.id, userId: 'A', idempotencyKey: 'k', verify: free });
  const overlap = s.hold({ tutorId: 'calc', userId: 'B', start: +at(15, 17, 30), end: +at(15, 18, 30) });
  assert.equal(overlap.ok, false);
  const after = s.hold({ tutorId: 'calc', userId: 'B', start: +at(15, 18), end: +at(15, 19) });
  assert.equal(after.ok, true, 'back-to-back is fine');
});

test('5. two confirms racing for one hold produce one booking', async () => {
  const { s } = store();
  const a = s.hold({ ...five, userId: 'A' });
  let release;
  const slow = () => new Promise((r) => { release = () => r({ free: true }); });
  const first = s.confirm({ reservationId: a.reservation.id, userId: 'A', idempotencyKey: 'tap1', verify: slow });
  const second = s.confirm({ reservationId: a.reservation.id, userId: 'A', idempotencyKey: 'tap2', verify: free });
  const secondResult = await second;
  release();
  const firstResult = await first;
  const winners = [firstResult, secondResult].filter((r) => r.ok && !r.replayed);
  assert.equal(winners.length, 1, 'a double tap is one booking');
});

test('5. a retried confirm after a dropped connection returns the original booking', async () => {
  const { s } = store();
  const a = s.hold({ ...five, userId: 'A' });
  const one = await s.confirm({ reservationId: a.reservation.id, userId: 'A', idempotencyKey: 'same', verify: free });
  const two = await s.confirm({ reservationId: a.reservation.id, userId: 'A', idempotencyKey: 'same', verify: free });
  assert.equal(two.ok, true);
  assert.equal(two.replayed, true);
  assert.equal(two.reservation.id, one.reservation.id);
});

test('5. the hold expiring during a slow provider check fails the confirm', async () => {
  const { s, advance } = store();
  const a = s.hold({ ...five, userId: 'A' });
  const slowVerify = async () => { advance(4 * 60 * 1000); return { free: true }; };
  const out = await s.confirm({ reservationId: a.reservation.id, userId: 'A', idempotencyKey: 'k', verify: slowVerify });
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'hold_expired', 'what was true before the await is checked again after it');
  assert.equal(s.hold({ ...five, userId: 'B' }).ok, true, 'and the slot is genuinely free again');
});

test('5. the live check overrides what the results screen showed', async () => {
  const { s } = store();
  const events = [];
  s.subscribe((e) => events.push(e.type));
  const a = s.hold({ ...five, userId: 'A' });
  const out = await s.confirm({ reservationId: a.reservation.id, userId: 'A', idempotencyKey: 'k',
    verify: async () => ({ free: false }) });           // the tutor took a phone booking
  assert.equal(out.reason, 'taken_upstream');
  assert.ok(events.includes('slot.taken'), 'everyone watching is told');
});

test('5. an unreachable provider books nothing and keeps the hold', async () => {
  const { s } = store();
  const a = s.hold({ ...five, userId: 'A' });
  const out = await s.confirm({ reservationId: a.reservation.id, userId: 'A', idempotencyKey: 'k',
    verify: async () => { throw new Error('timeout'); } });
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'provider_unreachable');
  assert.equal(s.get(a.reservation.id).status, 'held', 'the user can retry without losing the slot');
});

test('5. a confirm without an idempotency key is refused', async () => {
  const { s } = store();
  const a = s.hold({ ...five, userId: 'A' });
  const out = await s.confirm({ reservationId: a.reservation.id, userId: 'A', verify: free });
  assert.equal(out.reason, 'idempotency_key_required');
});

test('holds cannot be hoarded, and re-picking does not extend one', () => {
  const { s, advance } = store();
  const h1 = s.hold({ tutorId: 'calc', userId: 'A', start: +at(15, 17), end: +at(15, 18) });
  s.hold({ tutorId: 'calc', userId: 'A', start: +at(16, 17), end: +at(16, 18) });
  assert.equal(s.hold({ tutorId: 'calc', userId: 'A', start: +at(17, 17), end: +at(17, 18) }).reason, 'too_many_holds');
  advance(60 * 1000);
  const again = s.hold({ tutorId: 'calc', userId: 'A', start: +at(15, 17), end: +at(15, 18) });
  assert.equal(again.reused, true);
  assert.equal(again.reservation.expiresAt, h1.reservation.expiresAt, 'not extended');
});

test('a reschedule that fails leaves the original booking intact', async () => {
  const { s } = store();
  const a = s.hold({ ...five, userId: 'A' });
  await s.confirm({ reservationId: a.reservation.id, userId: 'A', idempotencyKey: 'k1', verify: free });
  const nextHold = s.hold({ tutorId: 'calc', userId: 'A', start: +at(17, 17), end: +at(17, 18) });
  const out = await s.reschedule({ fromId: a.reservation.id, toHoldId: nextHold.reservation.id, userId: 'A',
    idempotencyKey: 'k2', verify: async () => ({ free: false }) });
  assert.equal(out.ok, false);
  assert.equal(s.get(a.reservation.id).status, 'confirmed', 'never left with nothing');

  const retry = s.hold({ tutorId: 'calc', userId: 'A', start: +at(18, 17), end: +at(18, 18) });
  const ok = await s.reschedule({ fromId: a.reservation.id, toHoldId: retry.reservation.id, userId: 'A',
    idempotencyKey: 'k3', verify: free });
  assert.equal(ok.ok, true);
  assert.equal(s.get(a.reservation.id).status, 'cancelled');
  assert.equal(s.hold({ ...five, userId: 'B' }).ok, true, 'the old time is free for someone else');
});

/* ============================================================ 1. calendar */

const booked = { id: 'r42', start: Date.UTC(2026, 8, 16, 0, 0), end: Date.UTC(2026, 8, 16, 1, 0), status: 'confirmed', version: 3 };
const tutor = { name: 'Minji Park', nameKo: '박민지', location: 'Crowfoot Library, Calgary' };

test('1. the event carries tutor, subject, time, length and details', () => {
  const ics = cal.icsForBooking({ booking: booked, tutor, subjectLabel: 'Calculus', purposeLabel: 'Exam prep', now: NOW });
  const unfolded = ics.replace(/\r\n /g, '');
  for (const needle of ['UID:booking-r42@lonera.app', 'DTSTART:20260916T000000Z', 'DTEND:20260916T010000Z',
    'SUMMARY:Calculus with Minji Park', 'Length: 60 minutes', 'LOCATION:Crowfoot Library\\, Calgary', 'STATUS:CONFIRMED']) {
    assert.ok(unfolded.includes(needle), needle);
  }
});

test('1. a change keeps the UID and raises SEQUENCE; a cancellation is METHOD:CANCEL', () => {
  const v1 = cal.icsForBooking({ booking: booked, tutor, sequence: 0, now: NOW });
  const v2 = cal.icsForBooking({ booking: { ...booked, start: booked.start + 3600000, end: booked.end + 3600000 }, tutor, sequence: 1, now: NOW });
  const gone = cal.icsForBooking({ booking: { ...booked, status: 'cancelled' }, tutor, sequence: 2, now: NOW });
  const uid = (s) => /UID:(.*)/.exec(s)[1];
  assert.equal(uid(v1), uid(v2));
  assert.equal(uid(v2), uid(gone));
  assert.match(v2, /SEQUENCE:1/);
  assert.match(gone, /METHOD:CANCEL/);
  assert.match(gone, /STATUS:CANCELLED/);
});

test('1. folding counts octets, never splits a Korean character, and ends lines with CRLF', () => {
  const ics = cal.icsForBooking({ booking: booked, tutor, subjectLabel: '미적분', lang: 'ko', now: NOW });
  const enc = new TextEncoder();
  for (const line of ics.split('\r\n')) assert.ok(enc.encode(line).length <= 75, line);
  assert.ok(!ics.includes('�'));
  assert.ok(!/[^\r]\n/.test(ics), 'bare LF would be rejected');
});

test('1. Google event ids are stable, valid base32hex, and distinct per booking', () => {
  const a = cal.googleEventId('r42');
  assert.equal(a, cal.googleEventId('r42'), 'a retry reuses the id, so it cannot create a duplicate');
  assert.match(a, /^[a-v0-9]{5,1024}$/);
  assert.notEqual(a, cal.googleEventId('r43'));
  assert.match(cal.googleEventId('예약-7'), /^[a-v0-9]+$/);
  const body = cal.googleEventBody({ booking: booked, tutor, subjectLabel: 'Calculus' });
  assert.equal(body.id, a);
  assert.equal(body.extendedProperties.private.lonera_booking_id, 'r42');
});

test('1. the sync decision: insert, update on change, delete on cancel, otherwise nothing', () => {
  assert.deepEqual(cal.nextCalendarOp(booked, {}), { op: 'insert', sequence: 0 });
  assert.deepEqual(cal.nextCalendarOp(booked, { state: 'created', sequence: 0, syncedVersion: 3 }), { op: 'noop' });
  assert.deepEqual(cal.nextCalendarOp({ ...booked, version: 4 }, { state: 'created', sequence: 0, syncedVersion: 3 }),
    { op: 'update', sequence: 1 });
  assert.deepEqual(cal.nextCalendarOp({ ...booked, status: 'cancelled' }, { state: 'created', sequence: 1, syncedVersion: 4 }),
    { op: 'delete', sequence: 2 });
  assert.deepEqual(cal.nextCalendarOp({ ...booked, status: 'cancelled' }, { state: 'none' }), { op: 'noop' },
    'never create an event for a booking that is already cancelled');
});
