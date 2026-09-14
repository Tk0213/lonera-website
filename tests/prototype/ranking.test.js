'use strict';

/**
 * Feed-ranking tests.
 *
 * These pull the real functions out of app-preview.html rather than
 * reimplementing them. The app is deliberately a single file, so a copy of
 * the ranking rule kept here for testing would drift from the one that
 * ships - and the rule this file exists to protect is a legal one, so a
 * silently stale test is worse than no test.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const APP = fs.readFileSync(path.join(__dirname, '..', '..', 'apps', 'prototype', 'app-preview.html'), 'utf8');

/** Lift a top-level declaration out of the app source by name. */
function lift(kind, name, end) {
  const i = APP.indexOf(`${kind} ${name}`);
  assert.notEqual(i, -1, `${name} not found in app-preview.html`);
  return APP.slice(i, APP.indexOf(end, i) + end.length);
}

// the ranking surface, evaluated in one scope with `lang` and `interests` open
const scope = {};
const src = [
  lift('const', 'BIZ=[', '\n];'),
  lift('const', 'CATS=[', '];'),
  lift('const', 'NO_LANG_RANK=', ';'),
  lift('const', 'INTEREST_CAP=', ';'),
  lift('function', 'avTier(b)', '}'),
  lift('function', 'langPref()', '}'),
  lift('function', 'feedScore(b)', '\n}'),
  lift('function', 'feedOrder(list)', '}'),
].join('\n');
// eslint-disable-next-line no-new-func
const load = new Function('state', `
  const lang = state.lang, interests = state.interests;
  ${src}
  return { BIZ, feedScore, feedOrder, NO_LANG_RANK, INTEREST_CAP };
`);

function rank(lang, interests = {}) {
  const api = load({ lang, interests });
  return { ...api, order: (cat) => api.feedOrder(api.BIZ.filter((b) => b.c === cat)).map((b) => b.id) };
}

/* ------------------------------------------------------------------ housing */

test('housing order does not change when the interface language changes', () => {
  // The rule this whole file exists for. Interface language is a close proxy
  // for national origin, so letting it rank rentals is proxy discrimination
  // in the provision of housing.
  const en = rank('en').order('Rentals');
  const ko = rank('ko').order('Rentals');
  assert.deepEqual(ko, en, 'a Korean speaker and an English speaker see the same rentals order');
});

test('language does move a non-housing category', () => {
  // The control: without this the housing test proves nothing, because it
  // would pass just as well if language never affected any ranking at all.
  // Cleaning is the category where the order genuinely flips - a Korean
  // speaker is shown Sarang first, an English speaker Sparkle.
  const en = rank('en').order('Cleaning');
  const ko = rank('ko').order('Cleaning');
  assert.notDeepEqual(ko, en, 'language is a real ranking signal outside housing');
  assert.equal(ko[0], 'sarang', 'the Korean-speaking cleaner leads in Korean');
  assert.notEqual(en[0], 'sarang', 'and does not lead in English');
});

test('Rentals is the category held back from language ranking', () => {
  assert.ok(rank('en').NO_LANG_RANK.includes('Rentals'));
});

test('a Korean-speaking provider outranks an equal one in Korean, outside housing', () => {
  const { BIZ, feedScore } = rank('ko');
  const korean = BIZ.find((b) => b.id === 'haneul');   // Hair, Korean
  const other = BIZ.find((b) => b.id === 'nova');      // Hair, Mandarin
  assert.ok(feedScore(korean) > feedScore(other));
});

test('a Korean-speaking landlord gets no language credit', () => {
  const { BIZ, feedScore } = rank('ko');
  const b = BIZ.find((b2) => b2.id === 'maple');       // Rentals, Korean
  const en = rank('en');
  assert.equal(feedScore(b), en.feedScore(en.BIZ.find((b2) => b2.id === 'maple')),
    'the same listing scores the same in both languages');
});

/* ----------------------------------------------------------------- interest */

test('interest lifts a category without reordering inside it', () => {
  const cold = rank('en').order('Dental');
  const warm = rank('en', { Dental: 3 }).order('Dental');
  assert.deepEqual(warm, cold, 'interest is per-category, so it cannot reorder within one');
});

test('a tampered interest count cannot dominate the feed', () => {
  // The count is read back out of localStorage, so it is user-controlled
  // input. Clamping only on write would let an edited value bury every
  // other category.
  const d = (api) => api.feedScore(api.BIZ.find((b) => b.c === 'Dental'));
  const huge = rank('en', { Dental: 999999 });
  const capped = rank('en', { Dental: huge.INTEREST_CAP });
  assert.equal(d(huge), d(capped), 'a count past the cap scores the same as the cap');
  const negative = rank('en', { Dental: -50 });
  const none = rank('en', {});
  assert.equal(d(negative), d(none), 'a negative count cannot push a category down');
});

test('interest raises a category above an unvisited one', () => {
  const plain = rank('en');
  const keen = rank('en', { Taxes: 5 });
  const tax = (api) => api.feedScore(api.BIZ.find((b) => b.c === 'Taxes'));
  assert.ok(tax(keen) > tax(plain));
});
