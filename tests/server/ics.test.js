'use strict';

/**
 * iCal fetch limits.
 *
 * Regression tests for two holes found in review: the 2 MB cap was checked
 * only after the whole body was in memory, and the timeout was cleared as
 * soon as headers arrived, so a slow body could hang a request forever.
 * DNS is injected; nothing here touches the network.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fetchIcs } = require('../../apps/server/src/availability/adapters/ics');

const FEED = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n';
const URL_ = 'https://feeds.example.com/cal.ics';
const base = {
  windowStartMs: 0,
  windowEndMs: 86400000,
  resolver: { lookup: async () => [{ address: '93.184.216.34', family: 4 }] },
};
const noHeaders = { get: () => null };

test('an oversized feed is cut off while streaming, not after it is all in memory', async () => {
  let pulled = 0;
  const body = new ReadableStream({
    pull(c) {
      pulled += 1;
      if (pulled > 50) { c.close(); return; }
      c.enqueue(new Uint8Array(512 * 1024).fill(65));
    },
  });
  const res = { ok: true, status: 200, headers: noHeaders, body,
    text: async () => { throw new Error('must not buffer the whole body'); } };
  const out = await fetchIcs(URL_, { ...base, fetchImpl: async () => res });
  assert.equal(out.error, 'feed too large');
  assert.ok(pulled < 10, `stopped after ${pulled} chunks of 512 KB; before the fix it read all 50`);
});

test('a declared Content-Length over the cap is refused without reading the body', async () => {
  let opened = false;
  const res = {
    ok: true, status: 200,
    headers: { get: (h) => (String(h).toLowerCase() === 'content-length' ? String(50 * 1024 * 1024) : null) },
    body: { getReader() { opened = true; return new ReadableStream().getReader(); }, cancel: async () => {} },
  };
  const out = await fetchIcs(URL_, { ...base, fetchImpl: async () => res });
  assert.equal(out.error, 'feed too large');
  assert.equal(opened, false);
});

test('a feed that stalls mid-body times out instead of hanging', async () => {
  const fetchImpl = async (url, { signal }) => ({
    ok: true, status: 200, headers: noHeaders,
    body: new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode('BEGIN:VCALENDAR\r\n'));
        signal.addEventListener('abort', () => c.error(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      },
    }),
  });
  const out = await fetchIcs(URL_, { ...base, fetchImpl, timeoutMs: 60 });
  assert.equal(out.ok, false);
  assert.equal(out.error, 'feed timed out');
});

test('an ordinary small feed still parses', async () => {
  const res = { ok: true, status: 200, headers: noHeaders, body: new Response(FEED).body };
  const out = await fetchIcs(URL_, { ...base, fetchImpl: async () => res });
  assert.equal(out.ok, true);
});
