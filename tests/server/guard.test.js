'use strict';

/**
 * Outbound-request guard tests.
 *
 * These are regression tests for a real hole: before lib/net/guard.js existed,
 * fetchIcs would fetch any https URL it was given, including cloud metadata
 * and anything on the private network. Every case below reached the target.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkUrl, isBlockedAddress, safeFetch } = require('../../apps/server/src/net/guard');

// no real DNS in tests: the resolver is injected
const resolvesTo = (ip) => ({ lookup: async () => [{ address: ip, family: ip.includes(':') ? 6 : 4 }] });
const publicDns = resolvesTo('93.184.216.34');

/* ------------------------------------------------------------------ addresses */

test('cloud metadata and private ranges are refused', () => {
  for (const ip of ['169.254.169.254', '127.0.0.1', '10.0.0.7', '192.168.1.1', '172.16.5.5',
    '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '198.18.0.1']) {
    assert.equal(isBlockedAddress(ip), true, `${ip} must be refused`);
  }
});

test('IPv6 forms that wrap a private v4 address are refused', () => {
  // The URL parser normalises [::ffff:169.254.169.254] to ::ffff:a9fe:a9fe,
  // which a dotted-form-only check missed - this was a live bypass.
  for (const ip of ['::1', '::', '::ffff:a9fe:a9fe', '::ffff:169.254.169.254',
    'fd00::1', 'fe80::1', '64:ff9b::a9fe:a9fe', '::10.0.0.1']) {
    assert.equal(isBlockedAddress(ip), true, `${ip} must be refused`);
  }
});

test('ordinary public addresses are allowed', () => {
  for (const ip of ['93.184.216.34', '8.8.8.8', '2606:2800:220:1:248:1893:25c8:1946']) {
    assert.equal(isBlockedAddress(ip), false, `${ip} should be allowed`);
  }
});

test('anything that is not a parseable address is refused', () => {
  for (const v of ['', 'not-an-ip', '1.2.3', '1.2.3.4.5', '999.1.1.1', ':::1', '12345::']) {
    assert.equal(isBlockedAddress(v), true, `${JSON.stringify(v)} must be refused`);
  }
});

/* ----------------------------------------------------------------------- urls */

test('scheme, port and credentials are all enforced', async () => {
  const cases = [
    ['http://example.com/c.ics', /https/],
    ['file:///etc/passwd', /https/],
    ['gopher://127.0.0.1:11211/', /https/],
    ['https://example.com:8080/c.ics', /443/],
    ['https://user:pw@example.com/c.ics', /credentials/],
    ['not a url at all', /not a url/],
  ];
  for (const [url, expected] of cases) {
    const out = await checkUrl(url, { resolver: publicDns });
    assert.equal(out.ok, false, `${url} must be refused`);
    assert.match(out.error, expected);
  }
});

test('a public name that resolves to a private address is refused', async () => {
  // The shape of a real attack: nothing about the hostname looks wrong.
  const out = await checkUrl('https://feeds.example.com/cal.ics', {
    resolver: resolvesTo('169.254.169.254'),
  });
  assert.equal(out.ok, false);
  assert.match(out.error, /non-public address/);
});

test('one private answer among several is enough to refuse', async () => {
  const out = await checkUrl('https://feeds.example.com/cal.ics', {
    resolver: { lookup: async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ] },
  });
  assert.equal(out.ok, false, 'we do not control which address the socket picks');
});

test('a host that does not resolve is refused', async () => {
  const out = await checkUrl('https://nope.example/cal.ics', {
    resolver: { lookup: async () => { throw new Error('ENOTFOUND'); } },
  });
  assert.equal(out.ok, false);
  assert.match(out.error, /resolve/);
});

test('a normal public feed url passes', async () => {
  const out = await checkUrl('https://calendar.google.com/calendar/ical/x/basic.ics', { resolver: publicDns });
  assert.equal(out.ok, true);
});

/* ------------------------------------------------------------------ redirects */

test('a redirect into the private network is caught on the second hop', async () => {
  // redirect: 'follow' would have taken this without ever re-checking.
  let hops = 0;
  const fetchImpl = async () => {
    hops += 1;
    return { status: 302, headers: { get: () => 'https://169.254.169.254/latest/meta-data/' } };
  };
  const out = await safeFetch('https://feeds.example.com/cal.ics', {
    fetchImpl, resolver: publicDns,
  });
  assert.equal(out.ok, false);
  assert.match(out.error, /non-public address|not publicly routable/);
  assert.equal(hops, 1, 'the hostile hop is never requested');
});

test('a redirect chain cannot loop forever', async () => {
  let hops = 0;
  const fetchImpl = async () => {
    hops += 1;
    return { status: 302, headers: { get: () => 'https://feeds.example.com/again' } };
  };
  const out = await safeFetch('https://feeds.example.com/cal.ics', { fetchImpl, resolver: publicDns });
  assert.equal(out.ok, false);
  assert.match(out.error, /too many redirects/);
  assert.ok(hops <= 5, `bounded, got ${hops}`);
});

test('a redirect with no location is refused rather than retried', async () => {
  const fetchImpl = async () => ({ status: 302, headers: { get: () => null } });
  const out = await safeFetch('https://feeds.example.com/cal.ics', { fetchImpl, resolver: publicDns });
  assert.equal(out.ok, false);
  assert.match(out.error, /location/);
});
