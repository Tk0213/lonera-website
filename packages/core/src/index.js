/**
 * @lonera/core - everything the web app, the native app and the server agree on.
 *
 * Namespaced rather than flattened: `slots.sliceFree` and `ranking.score` say
 * where a rule lives, and a flat barrel of thirty names invites two modules to
 * quietly export the same one.
 */
export * as tiers from './tiers.js';
export * as slots from './slots.js';
export * as intent from './intent.js';
export * as ranking from './ranking.js';
export * as i18n from './i18n.js';
export * as businesses from './businesses.js';
export { createWaitlist, waitlist, MAX_PER_USER, HOLD_MS } from './waitlist.js';
