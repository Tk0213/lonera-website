/**
 * Availability tiers.
 *
 * The whole design turns on one fact: Google and Instagram publish OPENING
 * HOURS, not bookable slots. "Open 9-5" is not "11:30 is free". Real slots
 * only exist inside a booking system, so we can either be handed that system
 * or we cannot know. Rather than pretend, the app labels which of the three
 * situations each business is in, and never renders a guess as a fact.
 */

export const TIER = {
  /** The business gave us a calendar feed. Free/busy is real and current. */
  CONNECTED: 'connected',
  /** The business typed in their usual hours. Indicative only. */
  DECLARED: 'declared',
  /** We know nothing. Ask them. */
  UNKNOWN: 'unknown',
};

/**
 * What each tier is allowed to claim in the interface. `bookable` gates the
 * instant-book button: only a real feed earns it. Everything else routes to
 * request-and-confirm, which is the honest flow and also the one most of the
 * marketplace will use.
 */
export const TIER_RULES = {
  [TIER.CONNECTED]: {
    bookable: true,
    label: 'live',
    /** Past this age a feed is stale and demoted to DECLARED. */
    maxAgeSeconds: 600,
  },
  [TIER.DECLARED]: {
    bookable: false,
    label: 'usual hours',
    maxAgeSeconds: null,
  },
  [TIER.UNKNOWN]: {
    bookable: false,
    label: 'ask',
    maxAgeSeconds: null,
  },
};

/**
 * Demote a CONNECTED result whose feed has gone stale. A calendar we fetched
 * an hour ago is not live data, and showing it as bookable is how you
 * double-book someone.
 */
export function effectiveTier(tier, fetchedAtMs, nowMs = Date.now()) {
  const rule = TIER_RULES[tier];
  if (!rule || rule.maxAgeSeconds == null) return tier;
  if (!fetchedAtMs) return TIER.DECLARED;
  const ageSeconds = (nowMs - fetchedAtMs) / 1000;
  return ageSeconds > rule.maxAgeSeconds ? TIER.DECLARED : tier;
}

export function isBookable(tier) {
  return Boolean(TIER_RULES[tier] && TIER_RULES[tier].bookable);
}
