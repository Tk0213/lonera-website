'use strict';

/**
 * Standby queue tests.
 *
 * The queue's only real promise is that the order is the order. These tests
 * exist to make that promise checkable, including the cases where it would be
 * tempting to break it: simultaneous joins, someone gaming it by sitting in
 * every line, and two releases racing for one slot.
 */

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const wl = require('../lib/waitlist');

beforeEach(() => wl.reset());

/* ------------------------------------------------------------------- order */

test('the first to join is the first served', () => {
  wl.join('mirae', 1, '2:00 PM', 'ana');
  wl.join('mirae', 1, '2:00 PM', 'ben');
  wl.join('mirae', 1, '2:00 PM', 'cho');
  assert.equal(wl.position('mirae', 1, '2:00 PM', 'ana'), 1);
  assert.equal(wl.position('mirae', 1, '2:00 PM', 'cho'), 3);

  const out = wl.release('mirae', 1, '2:00 PM');
  assert.equal(out.claimed.userId, 'ana');
  assert.equal(out.remaining, 2);
  assert.equal(wl.position('mirae', 1, '2:00 PM', 'ben'), 1, 'everyone moves up one');
});

test('joining in the same millisecond still has a definite order', () => {
  // Timestamps tie; the sequence number cannot. Without this, "who was first"
  // would come down to sort stability.
  const t = 1_700_000_000_000;
  wl.join('mirae', 1, '2:00 PM', 'ana', { nowMs: t });
  wl.join('mirae', 1, '2:00 PM', 'ben', { nowMs: t });
  assert.equal(wl.release('mirae', 1, '2:00 PM').claimed.userId, 'ana');
});

test('joining twice does not buy a second place', () => {
  wl.join('mirae', 1, '2:00 PM', 'ana');
  wl.join('mirae', 1, '2:00 PM', 'ben');
  const again = wl.join('mirae', 1, '2:00 PM', 'ben');
  assert.equal(again.already, true);
  assert.equal(again.position, 2, 'still second, not bumped and not duplicated');
  assert.equal(wl.length('mirae', 1, '2:00 PM'), 2);
});

test('leaving the line moves everyone behind up', () => {
  wl.join('mirae', 1, '2:00 PM', 'ana');
  wl.join('mirae', 1, '2:00 PM', 'ben');
  assert.equal(wl.leave('mirae', 1, '2:00 PM', 'ana'), true);
  assert.equal(wl.position('mirae', 1, '2:00 PM', 'ben'), 1);
  assert.equal(wl.leave('mirae', 1, '2:00 PM', 'nobody'), false);
});

/* ------------------------------------------------------------ one slot once */

test('two releases cannot hand the same slot to two people', () => {
  wl.join('mirae', 1, '2:00 PM', 'ana');
  wl.join('mirae', 1, '2:00 PM', 'ben');
  const first = wl.release('mirae', 1, '2:00 PM');
  const second = wl.release('mirae', 1, '2:00 PM');
  assert.equal(first.claimed.userId, 'ana');
  assert.equal(second.claimed.userId, 'ben', 'the second release is a different person');
  assert.notEqual(first.claimed.userId, second.claimed.userId);
});

test('releasing an empty line gives nobody the slot', () => {
  const out = wl.release('mirae', 1, '2:00 PM');
  assert.equal(out.claimed, null);
  assert.deepEqual(out.skipped, []);
});

test('someone who cannot take it is skipped, not the whole line', () => {
  wl.join('mirae', 1, '2:00 PM', 'ana');
  wl.join('mirae', 1, '2:00 PM', 'ben');
  const out = wl.release('mirae', 1, '2:00 PM', { isEligible: (e) => e.userId !== 'ana' });
  assert.equal(out.claimed.userId, 'ben');
  assert.deepEqual(out.skipped.map((e) => e.userId), ['ana']);
});

test('an eligibility check that throws skips that person rather than the release', () => {
  wl.join('mirae', 1, '2:00 PM', 'ana');
  wl.join('mirae', 1, '2:00 PM', 'ben');
  const out = wl.release('mirae', 1, '2:00 PM', {
    isEligible: (e) => { if (e.userId === 'ana') throw new Error('lookup failed'); return true; },
  });
  assert.equal(out.claimed.userId, 'ben', 'one bad lookup must not strand the slot');
});

/* ----------------------------------------------------------------- gaming it */

test('one person cannot sit in every line', () => {
  // The user's own worry: people flooding the queue to be fastest. They can't
  // outrun the order, and this stops them buying more places in it.
  for (let i = 0; i < wl.MAX_PER_USER; i += 1) {
    assert.equal(wl.join('mirae', 1, `slot${i}`, 'greedy').ok, true);
  }
  const over = wl.join('mirae', 1, 'one-more', 'greedy');
  assert.equal(over.ok, false);
  assert.match(over.error, /too many/);
  assert.equal(wl.join('mirae', 1, 'one-more', 'someone-else').ok, true,
    'the cap is per person, not per slot');
});

test('leaving frees a place under the cap', () => {
  for (let i = 0; i < wl.MAX_PER_USER; i += 1) wl.join('mirae', 1, `slot${i}`, 'ana');
  assert.equal(wl.join('mirae', 1, 'extra', 'ana').ok, false);
  wl.leave('mirae', 1, 'slot0', 'ana');
  assert.equal(wl.join('mirae', 1, 'extra', 'ana').ok, true);
});

test('booking elsewhere clears every line this person was in', () => {
  wl.join('mirae', 1, '2:00 PM', 'ana');
  wl.join('hanriver', 2, '9:00 AM', 'ana');
  wl.join('mirae', 1, '2:00 PM', 'ben');
  assert.equal(wl.leaveAll('ana'), 2);
  assert.equal(wl.position('mirae', 1, '2:00 PM', 'ben'), 1);
  assert.equal(wl.forUser('ana').length, 0);
});

/* -------------------------------------------------------------------- holds */

test('auto-book claims outright; the others are held for confirmation', () => {
  wl.join('mirae', 1, '2:00 PM', 'ana', { autoBook: false });
  const held = wl.release('mirae', 1, '2:00 PM');
  assert.equal(held.claimed.booked, false, 'not booked without being asked');

  wl.reset();
  wl.join('mirae', 1, '2:00 PM', 'ben', { autoBook: true });
  assert.equal(wl.release('mirae', 1, '2:00 PM').claimed.booked, true);
});

test('a hold nobody confirms expires instead of sitting on the slot', () => {
  wl.join('mirae', 1, '2:00 PM', 'ana', { autoBook: false });
  const t = Date.now();
  wl.release('mirae', 1, '2:00 PM', { nowMs: t });
  assert.deepEqual(wl.sweepHolds({ nowMs: t + 1000 }), [], 'still within the window');
  const gone = wl.sweepHolds({ nowMs: t + wl.HOLD_MS + 1 });
  assert.equal(gone.length, 1);
  assert.equal(gone[0].userId, 'ana');
});

test('a confirmed hold is not swept', () => {
  wl.join('mirae', 1, '2:00 PM', 'ana', { autoBook: false });
  const t = Date.now();
  wl.release('mirae', 1, '2:00 PM', { nowMs: t });
  assert.equal(wl.confirmHold('mirae', 1, '2:00 PM'), true);
  assert.deepEqual(wl.sweepHolds({ nowMs: t + wl.HOLD_MS + 1 }), []);
});

/* --------------------------------------------------------------------- misc */

test('a missing field is refused rather than queued as undefined', () => {
  assert.equal(wl.join('', 1, '2:00 PM', 'ana').ok, false);
  assert.equal(wl.join('mirae', 1, '', 'ana').ok, false);
  assert.equal(wl.join('mirae', 1, '2:00 PM', '').ok, false);
});

test('forUser reports every line with its place and length', () => {
  wl.join('mirae', 3, '2:00 PM', 'ana');
  wl.join('mirae', 3, '2:00 PM', 'ben');
  wl.join('hanriver', 1, '9:00 AM', 'ana');
  const mine = wl.forUser('ben');
  assert.equal(mine.length, 1);
  assert.equal(mine[0].position, 2);
  assert.equal(mine[0].lineLength, 2);
  assert.deepEqual(wl.forUser('ana').map((x) => x.day), [1, 3], 'soonest day first');
});

test('the same slot on different days is a different line', () => {
  wl.join('mirae', 1, '2:00 PM', 'ana');
  wl.join('mirae', 2, '2:00 PM', 'ben');
  assert.equal(wl.release('mirae', 2, '2:00 PM').claimed.userId, 'ben');
  assert.equal(wl.position('mirae', 1, '2:00 PM', 'ana'), 1, 'untouched');
});
