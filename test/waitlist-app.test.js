'use strict';

/**
 * The app carries its own copy of the standby queue, because app-preview.html
 * is a single self-contained file and cannot require lib/waitlist.js.
 *
 * Two copies of a fairness rule is the actual risk here: the tested one stays
 * correct while the one people use drifts. So these tests lift the app's
 * functions out of the shipped HTML and check them against the same
 * expectations as the server module - and directly against it where the
 * behaviour should be identical.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const server = require('../lib/waitlist');

const APP = fs.readFileSync(path.join(__dirname, '..', 'app-preview.html'), 'utf8');

function lift(name, end) {
  const i = APP.indexOf(name);
  assert.notEqual(i, -1, `${name} not found in app-preview.html`);
  return APP.slice(i, APP.indexOf(end, i) + end.length);
}

function loadApp() {
  const src = [
    lift('const WL_MAX=3, WL_ME="me";', ';'),
    'let wlSeq=0; const wlLines={};',
    lift('const wlKey=', ';'),
    lift('function wlLine(', '}'),
    lift('function wlMine(', '}'),
    lift('function wlPos(', '}'),
    lift('function wlJoin(', '\n}'),
    lift('function wlLeave(', '\n}'),
    lift('function wlRelease(', '\n}'),
    lift('function wlSeedOthers(', '\n}'),
  ].join('\n');
  // eslint-disable-next-line no-new-func
  return new Function(`${src}
    return { wlJoin, wlLeave, wlPos, wlRelease, wlLine, wlSeedOthers, wlMine, WL_MAX, WL_ME };`)();
}

test('the app copy serves the line in join order', () => {
  const a = loadApp();
  // other0/other1 are seeded ahead deterministically; add me last
  a.wlLine('mirae', 1, '2:00 PM').push({ seq: 1, user: 'first', auto: true });
  a.wlJoin('mirae', 1, '2:00 PM');
  assert.equal(a.wlPos('mirae', 1, '2:00 PM'), 2);
  assert.equal(a.wlRelease('mirae', 1, '2:00 PM').user, 'first');
  assert.equal(a.wlPos('mirae', 1, '2:00 PM'), 1, 'I move up to the front');
  assert.equal(a.wlRelease('mirae', 1, '2:00 PM').user, a.WL_ME, 'then it is mine');
});

test('the app copy removes the claimant, so one slot is claimed once', () => {
  const a = loadApp();
  a.wlJoin('mirae', 1, '2:00 PM');
  assert.equal(a.wlRelease('mirae', 1, '2:00 PM').user, a.WL_ME);
  assert.equal(a.wlRelease('mirae', 1, '2:00 PM'), null, 'the line is empty, not re-serving me');
});

test('the app copy enforces the same per-person cap as the server', () => {
  const a = loadApp();
  assert.equal(a.WL_MAX, server.MAX_PER_USER, 'the two copies must agree on the cap');
  for (let i = 0; i < a.WL_MAX; i += 1) assert.equal(a.wlJoin('mirae', 1, `s${i}`).ok, true);
  const over = a.wlJoin('mirae', 1, 'one-more');
  assert.equal(over.ok, false);
  assert.equal(over.error, 'max');
});

test('the app copy will not give one person two places in a line', () => {
  const a = loadApp();
  a.wlJoin('mirae', 1, '2:00 PM');
  a.wlJoin('mirae', 1, '2:00 PM');
  assert.equal(a.wlLine('mirae', 1, '2:00 PM').filter((e) => e.user === a.WL_ME).length, 1);
});

test('app and server agree on who wins, given the same joins', () => {
  const a = loadApp();
  server.reset();
  // three joiners in a fixed order, in both implementations
  const order = ['ana', 'ben', 'cho'];
  order.forEach((u) => server.join('mirae', 1, '2:00 PM', u));
  order.forEach((u, i) => a.wlLine('mirae', 1, '2:00 PM').push({ seq: i + 1, user: u, auto: true }));
  for (const expected of order) {
    assert.equal(server.release('mirae', 1, '2:00 PM').claimed.userId, expected);
    assert.equal(a.wlRelease('mirae', 1, '2:00 PM').user, expected);
  }
  server.reset();
});

test('seeded waiting people are stable, not reshuffled on every paint', () => {
  // "3rd in line" has to mean the same thing when the grid repaints.
  const a = loadApp();
  a.wlSeedOthers('mirae', 1, '2:00 PM');
  const first = a.wlLine('mirae', 1, '2:00 PM').length;
  a.wlSeedOthers('mirae', 1, '2:00 PM');
  assert.equal(a.wlLine('mirae', 1, '2:00 PM').length, first, 'seeding twice does not add more');

  const b = loadApp();
  b.wlSeedOthers('mirae', 1, '2:00 PM');
  assert.equal(b.wlLine('mirae', 1, '2:00 PM').length, first,
    'and a fresh page shows the same queue length for the same slot');
});

test('leaving the line frees a place under the cap', () => {
  const a = loadApp();
  for (let i = 0; i < a.WL_MAX; i += 1) a.wlJoin('mirae', 1, `s${i}`);
  assert.equal(a.wlJoin('mirae', 1, 'extra').ok, false);
  assert.equal(a.wlLeave('mirae', 1, 's0'), true);
  assert.equal(a.wlJoin('mirae', 1, 'extra').ok, true);
  assert.equal(a.wlLeave('mirae', 1, 'not-a-line'), false);
});
