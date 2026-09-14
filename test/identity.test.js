'use strict';

/**
 * Standby identity tests.
 *
 * The signature check is the whole of the queue's integrity: if a caller can
 * mint an id, they can flood a line with invented people or take somebody
 * else's place away. A silent regression here would not look like a bug, it
 * would look like an unfair queue.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const SECRET = 'secret-for-tests';
process.env.STANDBY_SECRET = SECRET;
// required after the env var is set, since the secret is read at load time
const { identify } = require('../server');

const sign = (id, secret = SECRET) =>
  `${id}.${crypto.createHmac('sha256', secret).update(id).digest('base64url')}`;

test('a token this server signed is accepted', () => {
  assert.equal(identify(sign('ana')), 'ana');
  assert.equal(identify(sign('user_123-ABC')), 'user_123-ABC');
});

test('anything we did not sign is refused', () => {
  assert.equal(identify('ana'), null, 'an id with no signature');
  assert.equal(identify('ana.'), null, 'an empty signature');
  assert.equal(identify('ana.made-up'), null, 'a wrong signature');
  assert.equal(identify(sign('ana', 'a-different-secret')), null, 'signed with the wrong key');
  assert.equal(identify(`ben.${sign('ana').split('.')[1]}`), null, "ana's signature on ben's id");
});

test('a missing or non-string token is refused rather than throwing', () => {
  for (const v of [undefined, null, '', 0, {}, [], true]) {
    assert.equal(identify(v), null, `${JSON.stringify(v)} must be refused`);
  }
});

test('an id outside the allowed shape is refused even when correctly signed', () => {
  // keeps ids usable as storage keys, and keeps "../" style values out
  for (const id of ['../etc', 'has space', 'a'.repeat(65), 'semi;colon', '<script>']) {
    assert.equal(identify(sign(id)), null, `${id} must be refused`);
  }
});

test('the length check runs before the timing-safe compare', () => {
  // crypto.timingSafeEqual throws on mismatched lengths; a short signature
  // must come back as null rather than crashing the request.
  assert.doesNotThrow(() => identify('ana.x'));
  assert.equal(identify('ana.x'), null);
});
