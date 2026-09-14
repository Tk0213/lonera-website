/**
 * Feed order.
 *
 * Personalised ranking, shaped so the legal constraint is the architecture
 * rather than a policy document beside it.
 *
 *   The profile never leaves the device. Interests are counted from this
 *   person's own taps. There is no profile on a server to breach, subpoena or
 *   sell, and no third-party or data-broker input at all - which is also what
 *   makes consent honest under PIPEDA and Alberta's PIPA. This module takes
 *   the counts as an argument and never reads storage itself, so that property
 *   is the caller's to keep and easy to audit.
 *
 *   Language never ranks housing. In this app the interface language is a
 *   close proxy for national origin, and using a proxy for a protected ground
 *   to decide who sees a rental listing is discrimination whether or not
 *   anyone intended it - which is what Meta was sued over and settled.
 *   Housing is ranked on the person's own category interest alone. Everywhere
 *   else, matching a provider who speaks their language is the entire point
 *   of the product.
 *
 *   The order is explainable. `explain()` exists because a ranking someone
 *   cannot inspect is one they cannot challenge.
 */

/** Categories that must never be ranked by language. */
export const NO_LANG_RANK = ['Rentals'];

/** One browsing spree must not define somebody. */
export const INTEREST_CAP = 5;

const clamp = (n) => Math.min(Math.max(Number.isFinite(+n) ? Math.trunc(+n) : 0, 0), INTEREST_CAP);

/**
 * @param {object} b        a business record
 * @param {object} opts
 * @param {object} opts.interests  { [category]: count } from this device only
 * @param {string} opts.language   the language the reader wants to be served in
 * @param {function} [opts.tierOf] (b) => tier, so a live feed can outrank
 */
export function score(b, { interests = {}, language = 'English', tierOf } = {}) {
  // Clamped on read as well as on write: the count comes back out of device
  // storage, which is user-controlled input, and an uncapped value would let
  // one category bury every other.
  let s = clamp(interests[b.c]) * 4;
  if (!NO_LANG_RANK.includes(b.c) && (b.lg || []).includes(language)) s += 5;
  const tier = typeof tierOf === 'function' ? tierOf(b) : b.av;
  if (tier === 'connected') s += 2;        // a bookable time is more useful
  return s + (Number(b.r) || 0);
}

export function order(list, opts) {
  return list.slice().sort((a, b) => score(b, opts) - score(a, opts));
}

/** What the ranking is using, for the "why this order?" sheet. */
export function explain(interests = {}) {
  return Object.entries(interests)
    .map(([category, n]) => ({ category, count: clamp(n) }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
}

/** Record one tap. Returns a new object rather than mutating. */
export function noteInterest(interests, category) {
  if (!category) return interests;
  return { ...interests, [category]: clamp((interests[category] || 0) + 1) };
}
