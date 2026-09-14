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

const SERVICES = ['Clinic', 'Dental', 'Immigration', 'Cleaning', 'Hair', 'Tutoring',
  'Rentals', 'Renovation', 'Auto', 'Taxes', 'Catering'];
const LANGUAGES = ['Korean', 'Tagalog', 'Mandarin', 'Punjabi', 'English'];
const ACTIONS = ['find', 'book', 'sell', 'job', 'ask'];

const SYSTEM = `You turn a person's request into one JSON object for a local-services marketplace in Calgary serving newcomer communities.

Return ONLY this shape, no prose:
{"service":<one of ${SERVICES.join('|')} or null>,
 "language":<one of ${LANGUAGES.join('|')} or null>,
 "action":<one of ${ACTIONS.join('|')}>,
 "whenText":<a short phrase such as "tomorrow", "friday morning", or null>,
 "urgent":<true|false>}

Rules:
- Pick a service only if the request clearly needs one of the listed categories. Never invent a category.
- language is the language the person wants to be served in, not the language they typed.
- action "book" only if they asked for an appointment or a time; otherwise "find".
- Do not add fields. Do not explain.`;

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

/** Keep only values we actually recognise. Anything else is dropped. */
function sanitize(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const pick = (v, allowed) =>
    typeof v === 'string' && allowed.includes(v) ? v : null;
  const whenText = typeof raw.whenText === 'string' && raw.whenText.length <= 40
    ? raw.whenText.replace(/[<>]/g, '').trim() || null
    : null;
  const action = pick(raw.action, ACTIONS);
  return {
    service: pick(raw.service, SERVICES),
    language: pick(raw.language, LANGUAGES),
    action: action || 'find',
    whenText,
    urgent: raw.urgent === true,
  };
}

/** Strip a ```json fence if a provider adds one despite being asked not to. */
function parseJsonish(text) {
  const t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(t); } catch { /* fall through */ }
  const m = /\{[\s\S]*\}/.exec(t);
  if (m) { try { return JSON.parse(m[0]); } catch { /* give up */ } }
  return null;
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
