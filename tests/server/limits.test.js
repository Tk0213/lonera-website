'use strict';

/**
 * Abuse-limit tests: who counts as one caller, and what a standby slot may be.
 *
 * Both were found by attacking a running server. Keyed on the full address,
 * one IPv6 home connection could rotate through 2^64 addresses and never meet
 * a rate limit; and the standby routes accepted any 24 characters as a slot.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.STANDBY_SECRET = 'secret-for-limit-tests';
const crypto = require('node:crypto');
const app = require('../../apps/server/server');
const { clientKey } = app;

test('addresses in one IPv6 /64 count as one caller', () => {
  const a = clientKey('2001:db8:1:2:aaaa:bbbb:cccc:1');
  const b = clientKey('2001:db8:1:2::ffff');
  const c = clientKey('2001:0db8:0001:0002:0:0:0:9');
  assert.equal(a, b);
  assert.equal(a, c);
  assert.equal(a, '2001:db8:1:2::/64');
});

test('different /64s stay different callers', () => {
  assert.notEqual(clientKey('2001:db8:1:2::1'), clientKey('2001:db8:1:3::1'));
});

test('an IPv4-mapped address counts as the IPv4 it is', () => {
  assert.equal(clientKey('::ffff:203.0.113.7'), '203.0.113.7');
  assert.equal(clientKey('203.0.113.7'), '203.0.113.7');
});

test('something unparseable is still a key, never a crash', () => {
  assert.equal(clientKey(undefined), '');
  assert.equal(clientKey('not:an:address:::x'), 'not:an:address:::x');
});

function post(port, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({ port, path, method: 'POST', headers: {
      'content-type': 'application/json', 'content-length': Buffer.byteLength(data), 'x-lonera-token': token,
    } }, (res) => { let s = ''; res.on('data', (d) => { s += d; }); res.on('end', () => resolve({ status: res.statusCode, body: s })); });
    req.on('error', reject);
    req.end(data);
  });
}

test('standby accepts only a real canonical clock time', async () => {
  const id = 'limit-tester';
  const token = `${id}.${crypto.createHmac('sha256', process.env.STANDBY_SECRET).update(id).digest('base64url')}`;
  const server = app.listen(0);
  const { port } = server.address();
  try {
    for (const slot of ['zzz', '25:99 PM', '9:3 AM', '09:30 AM', '9:30am', '9:60 AM', '<b>9</b>', '']) {
      const r = await post(port, '/api/standby/sparkle/join', { day: 1, slot }, token);
      assert.equal(r.status, 400, `slot ${JSON.stringify(slot)} should be refused`);
    }
    const ok = await post(port, '/api/standby/sparkle/join', { day: 1, slot: ' 9:30 AM ' }, token);
    assert.equal(ok.status, 200);
  } finally {
    server.close();
  }
});
