'use strict';

/**
 * What a client may believe from an availability response.
 *
 * Written after forging the response in a browser: a payload that only said
 * {tier:"connected"} made the web app display "straight from this business's
 * own calendar" over times the server had made up. The strongest claim this
 * product makes has to arrive with its proof.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

let core;
test('load core', async () => { core = await import('@lonera/core'); });

const NOW = 1_800_000_000_000;

test('a live claim with a fresh feed behind it is believed', () => {
  const { acceptTier, TIER } = core.tiers;
  assert.equal(acceptTier({ tier: 'connected', fetchedAt: NOW - 30_000 }, NOW), TIER.CONNECTED);
});

test('a live claim with no feed behind it is demoted, not believed', () => {
  const { acceptTier, TIER } = core.tiers;
  assert.equal(acceptTier({ tier: 'connected' }, NOW), TIER.DECLARED);
  assert.equal(acceptTier({ tier: 'connected', fetchedAt: null }, NOW), TIER.DECLARED);
  assert.equal(acceptTier({ tier: 'connected', fetchedAt: 'now' }, NOW), TIER.DECLARED);
  assert.equal(acceptTier({ tier: 'connected', fetchedAt: 0 }, NOW), TIER.DECLARED);
});

test('a live claim whose feed has gone stale is demoted', () => {
  const { acceptTier, TIER } = core.tiers;
  assert.equal(acceptTier({ tier: 'connected', fetchedAt: NOW - 11 * 60_000 }, NOW), TIER.DECLARED);
});

test('a tier outside the vocabulary is refused, never guessed at', () => {
  const { acceptTier } = core.tiers;
  for (const tier of ['CONNECTED', 'live', 'bookable', '', 'toString', '__proto__', 42, null]) {
    assert.equal(acceptTier({ tier }, NOW), null, `refused: ${String(tier)}`);
  }
  assert.equal(acceptTier(null, NOW), null);
  assert.equal(acceptTier('connected', NOW), null);
});

test('the quieter tiers pass through as they are', () => {
  const { acceptTier, TIER } = core.tiers;
  assert.equal(acceptTier({ tier: 'declared' }, NOW), TIER.DECLARED);
  assert.equal(acceptTier({ tier: 'unknown' }, NOW), TIER.UNKNOWN);
});
