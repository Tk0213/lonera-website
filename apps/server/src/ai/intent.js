'use strict';

/**
 * Intent parsing, provider-agnostic, with the hand-written parser as the floor.
 *
 * The app already ships a substring matcher that resolves the common shapes
 * ("find a korean doctor near me and book tomorrow"). It is fast, free, works
 * offline and never hallucinates - so it stays as the fallback rather than
 * being replaced. The model is there for the phrasings the matcher cannot
 * reach: "my landlord won't fix the heat and I need someone who speaks
 * Tagalog", "cheapest place to get my kid's teeth checked before school
 * starts".
 *
 * Two rules make this safe:
 *   1. The model may only choose from enumerated services and languages. A
 *      value outside the enum is dropped, not passed through, so a model that
 *      invents "Plumbing" cannot make the app search for a category that does
 *      not exist.
 *   2. Model output is data, never instruction. It is parsed as JSON and every
 *      field is validated against the enums below before anything uses it.
 */

const gemini = require('./providers/gemini');
const openai = require('./providers/openai');

/* The enums, the prompt, the sanitizer and the JSON parsing are shared with
   every app through @lonera/core. What stays here is what only a server can
   do: call a model with an API key. */
const {
  SERVICES, LANGUAGES, ACTIONS, SYSTEM, sanitize, parseJsonish,
} = require('@lonera/core').intent;

const PROVIDERS = { gemini, openai };

/** Order to try. Explicit env wins; otherwise whichever is configured. */
function providerOrder(preferred) {
  const order = [];
  if (preferred && PROVIDERS[preferred]) order.push(preferred);
  const envPref = process.env.AI_PROVIDER;
  if (envPref && PROVIDERS[envPref] && !order.includes(envPref)) order.push(envPref);
  for (const name of ['gemini', 'openai']) if (!order.includes(name)) order.push(name);
  return order;
}

/**
 * Parse one utterance.
 * @returns {{ok:boolean, intent?:object, provider?:string, fallback?:boolean, error?:string}}
 */
async function parse(text, opts = {}) {
  const utterance = String(text || '').slice(0, 500).trim();
  if (!utterance) return { ok: false, error: 'empty' };

  const tried = [];
  for (const name of providerOrder(opts.provider)) {
    const res = await PROVIDERS[name].complete({
      system: SYSTEM,
      user: utterance,
      json: true,
      fetchImpl: opts.fetchImpl,
      ...(opts.model ? { model: opts.model } : {}),
    });
    if (res.unconfigured) { tried.push({ name, skipped: 'no key' }); continue; }
    if (!res.ok) { tried.push({ name, error: res.error }); continue; }
    const intent = sanitize(parseJsonish(res.text));
    if (!intent) { tried.push({ name, error: 'unparseable output' }); continue; }
    return { ok: true, intent, provider: res.provider, model: res.model, tried };
  }
  // every provider unavailable: the caller falls back to the local parser,
  // which is a working answer rather than an outage
  return { ok: false, error: 'no provider available', fallback: true, tried };
}

module.exports = { parse, sanitize, parseJsonish, SERVICES, LANGUAGES, ACTIONS, SYSTEM };
