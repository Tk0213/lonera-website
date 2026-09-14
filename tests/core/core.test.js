'use strict';

/**
 * @lonera/core equivalence tests.
 *
 * core was extracted from app-preview.html, not rewritten, and the point of
 * these tests is to prove that claim rather than assert it. If core and the
 * prototype ever disagree about who ranks first or which service a sentence
 * names, one of them is wrong and users are seeing the difference.
 *
 * These replace the drift tests that existed only because the same rules were
 * written twice. Once the web app is the product and the prototype retires,
 * this file goes with it.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const core = require('../../packages/core/src/index.js');
const APP = fs.readFileSync(path.join(__dirname, '..', '..', 'apps', 'prototype', 'app-preview.html'), 'utf8');

/** Lift a top-level declaration out of the prototype by name. */
function lift(kind, name, end) {
  const i = APP.indexOf(`${kind} ${name}`);
  assert.notEqual(i, -1, `${name} not found in app-preview.html`);
  return APP.slice(i, APP.indexOf(end, i) + end.length);
}

function appRanking(lang, interests) {
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
  return new Function(`
    const lang = ${JSON.stringify(lang)}, interests = ${JSON.stringify(interests)};
    ${src}
    return { BIZ, feedOrder };`)();
}

/* -------------------------------------------------------------- ranking */

test('core ranks identically to the prototype, across languages and interests', () => {
  const cats = ['Cleaning', 'Hair', 'Rentals', 'Dental', 'Plumbing', 'Tutoring', 'Electrical'];
  const profiles = [{}, { Dental: 3 }, { Plumbing: 5 }, { Rentals: 5 }];
  let checked = 0;
  for (const cat of cats) {
    for (const lang of ['en', 'ko']) {
      for (const interests of profiles) {
        const app = appRanking(lang, interests);
        const appIds = app.feedOrder(app.BIZ.filter((b) => b.c === cat)).map((b) => b.id);
        const coreIds = core.ranking.order(core.businesses.byCategory(cat), {
          interests, language: lang === 'ko' ? 'Korean' : 'English',
        }).map((b) => b.id);
        assert.deepEqual(coreIds, appIds, `${cat} / ${lang} / ${JSON.stringify(interests)}`);
        checked += 1;
      }
    }
  }
  assert.ok(checked >= 56, `expected a broad sweep, checked ${checked}`);
});

test('housing order is language-invariant, and a control category is not', () => {
  const ids = (cat, language) =>
    core.ranking.order(core.businesses.byCategory(cat), { language }).map((b) => b.id);
  assert.deepEqual(ids('Rentals', 'Korean'), ids('Rentals', 'English'),
    'a Korean speaker and an English speaker must see the same rentals order');
  // Without this control the assertion above would pass even if language
  // ranked nothing at all. Cleaning is the category where the order flips.
  assert.notDeepEqual(ids('Cleaning', 'Korean'), ids('Cleaning', 'English'));
  assert.equal(ids('Cleaning', 'Korean')[0], 'sarang');
});

/* --------------------------------------------------------------- intent */

test('core parses the flagship request the same way the prototype does', () => {
  const q = 'i need a plumber, cleaner, electrician to come see this week who speaks korean';
  const p = core.intent.parseLocal(q);
  assert.deepEqual(p.services, ['Plumbing', 'Cleaning', 'Electrical'], 'in the order named');
  assert.equal(p.language, 'Korean');
  assert.equal(p.week, true);
  assert.equal(p.action, 'book');
});

test('Korean input reaches the same services', () => {
  const p = core.intent.parseLocal('배관 전기 청소 이번 주 한국어');
  assert.deepEqual(p.services.sort(), ['Cleaning', 'Electrical', 'Plumbing']);
  assert.equal(p.language, 'Korean');
});

test('a hallucinated service never survives sanitize', () => {
  assert.deepEqual(core.intent.sanitize({ services: ['Roofing'] }).services, []);
  assert.deepEqual(
    core.intent.sanitize({ services: ['Plumbing', 'Roofing', 'Plumbing', 'Hair', 'Auto', 'Taxes'] }).services,
    ['Plumbing', 'Hair', 'Auto', 'Taxes'], 'invented dropped, duplicate collapsed, capped');
  assert.deepEqual(core.intent.sanitize({ services: 'not an array' }).services, []);
});

/* ---------------------------------------------------------------- slots */

test('the canonical label does not depend on a locale', () => {
  // en-CA renders "9:30 a.m.", which does not match SLOT_LABELS and silently
  // broke both the standby queue keys and the Korean display.
  const label = core.slots.canonicalLabel(new Date(2026, 8, 14, 9, 30));
  assert.equal(label, '9:30 AM');
  assert.ok(core.slots.SLOT_LABELS.includes(label));
  assert.equal(core.slots.formatSlot(label, 'ko'), '오전 9:30');
  assert.equal(core.slots.canonicalLabel(new Date(2026, 8, 14, 12, 0)), '12:00 PM');
  assert.equal(core.slots.canonicalLabel(new Date(2026, 8, 14, 0, 5)), '12:05 AM');
  assert.equal(core.slots.canonicalLabel('nonsense'), null);
});

test('sample slots are stable for a business and day, and differ across days', () => {
  const a = core.slots.sampleSlots('sparkle', 0);
  assert.deepEqual(core.slots.sampleSlots('sparkle', 0), a, 'reopening must not reshuffle');
  assert.notDeepEqual(core.slots.sampleSlots('sparkle', 3), a, 'a different day is a different day');
});

/* ----------------------------------------------------------------- i18n */

test('both languages carry the same keys', () => {
  const { missingInKo, missingInEn } = core.i18n.missingKeys();
  assert.deepEqual(missingInKo, [], 'keys missing from Korean');
  assert.deepEqual(missingInEn, [], 'keys missing from English');
});

test('t falls back rather than rendering undefined', () => {
  const t = core.i18n.makeT('ko');
  assert.equal(t('avLive'), '실시간 예약');
  assert.equal(t('a-key-that-does-not-exist'), 'a-key-that-does-not-exist');
});

/* ------------------------------------------------------------- waitlist */

test('each waitlist instance is independent', () => {
  const a = core.createWaitlist();
  const b = core.createWaitlist();
  a.join('mirae', 1, '2:00 PM', 'ana');
  assert.equal(a.length('mirae', 1, '2:00 PM'), 1);
  assert.equal(b.length('mirae', 1, '2:00 PM'), 0, 'one app must not mutate another');
});

test('order and single-claim survive the port to a factory', () => {
  const wl = core.createWaitlist();
  ['ana', 'ben', 'cho'].forEach((u) => wl.join('mirae', 1, '2:00 PM', u));
  assert.equal(wl.release('mirae', 1, '2:00 PM').claimed.userId, 'ana');
  assert.equal(wl.release('mirae', 1, '2:00 PM').claimed.userId, 'ben');
  assert.equal(wl.position('mirae', 1, '2:00 PM', 'cho'), 1);
});
