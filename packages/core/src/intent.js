/**
 * What a sentence is asking for.
 *
 * Two parsers live here on purpose, and the order matters. `parseLocal` is a
 * substring matcher: free, instant, works offline, and it cannot hallucinate.
 * It is the floor, not the fallback. A model is worth calling only for the
 * phrasings it cannot reach - "my landlord won't fix the heat and I need
 * someone who speaks Tagalog" - and `sanitize` is what makes that safe.
 *
 * Two rules keep model output harmless:
 *   1. It may only choose from the enums below. A value outside them is
 *      dropped, never passed through, so an invented trade cannot become a
 *      visit on somebody's calendar.
 *   2. It is data, never instruction. It is parsed as JSON and every field is
 *      validated before anything reads it.
 *
 * This file is the single copy. The app used to carry `parseIntent` while the
 * server carried `sanitize`, and the two disagreed about how many services a
 * request could name.
 */

export const SERVICES = ['Clinic', 'Dental', 'Immigration', 'Cleaning', 'Hair', 'Tutoring',
  'Rentals', 'Renovation', 'Auto', 'Taxes', 'Catering', 'Plumbing', 'Electrical'];
export const LANGUAGES = ['Korean', 'Tagalog', 'Mandarin', 'Punjabi', 'English'];
export const ACTIONS = ['find', 'book', 'sell', 'job', 'ask'];

/** One request can name several trades. Past this it stops being an errand. */
export const MAX_SERVICES = 4;

const P_SERVICE =[
 ["Clinic",["doctor","physician","clinic","family doc","walk-in","의사","병원","진료","의원"]],
 ["Dental",["dentist","dental","tooth","teeth","치과"]],
 ["Immigration",["immigration","visa","work permit","permanent residence","이민","비자","영주권"]],
 ["Cleaning",["clean","cleaner","housekeep","maid","청소"]],
 ["Hair",["haircut","hair","salon","perm","barber","미용","파마","머리"]],
 ["Tutoring",["tutor","lesson","math","homework","과외","학원"]],
 ["Rentals",["rent","rental","apartment","room","lease","렌트","월세","방"]],
 ["Renovation",["renovat","basement","contractor","remodel","리노","공사"]],
 ["Auto",["mechanic","car repair","auto repair","tire","brake","정비","자동차"]],
 ["Taxes",["tax","accountant","bookkeep","세무","세금"]],
 ["Catering",["cater","party tray","케이터링"]],
 ["Plumbing",["plumber","plumbing","leak","drain","pipe","toilet","water heater","배관","누수","수도"]],
 ["Electrical",["electrician","electrical","wiring","outlet","breaker","panel","전기","배선","콘센트"]]
];
const P_LANG =[["Korean",["korean","한국어","한인","한국말"]],
 ["Tagalog",["tagalog","filipino","필리핀"]],
 ["Mandarin",["mandarin","chinese","중국어"]],
 ["Punjabi",["punjabi","hindi","urdu"]]];
const P_ACTION =[["book",["appointment","book ","booking","schedule","reserve","예약"]],
 ["sell",["sell","selling","팔기","팔아"]],
 ["job",["job","hiring","채용","구인"]],
 ["ask",["ask the community","커뮤니티"]]];
const DAYWORDS =[["monday","월요일"],["tuesday","화요일"],["wednesday","수요일"],
 ["thursday","목요일"],["friday","금요일"],["saturday","토요일"],["sunday","일요일"]];

export { P_SERVICE, P_LANG, P_ACTION, DAYWORDS };

export const SYSTEM = `You turn a person's request into one JSON object for a local-services marketplace in Calgary serving newcomer communities.

Return ONLY this shape, no prose:
{"services":<array of 1-4 from ${SERVICES.join('|')}, in the order the person named them, or []>,
 "language":<one of ${LANGUAGES.join('|')} or null>,
 "action":<one of ${ACTIONS.join('|')}>,
 "whenText":<a short phrase such as "tomorrow", "friday morning", or null>,
 "urgent":<true|false>}

Rules:
- List every service the request needs, in the order they were named: "a plumber, a cleaner and an electrician" is ["Plumbing","Cleaning","Electrical"], not one of them. Never invent a category.
- language is the language the person wants to be served in, not the language they typed.
- action "book" only if they asked for an appointment or a time; otherwise "find".
- Do not add fields. Do not explain.`;

/**
 * The local matcher. Returns every service named, in the order they were said:
 * "a plumber, a cleaner and an electrician" is one errand with three parts,
 * and collapsing it to the first match is what made people search three times.
 *
 * @param {string} raw
 * @param {Date} [now] injectable so tests are not time-dependent
 */
export function parseLocal(raw, now = new Date()) {
  const s = ` ${String(raw || '').toLowerCase()} `;
  const pick = (table) => {
    for (const [key, words] of table) if (words.some(w => s.includes(w))) return key;
    return null;
  };
  const todayIdx = (now.getDay() + 6) % 7;              // 0 = Monday
  let when = null;
  if (s.includes('tomorrow') || s.includes('내일')) when = (todayIdx + 1) % 7;
  else if (s.includes('today') || s.includes('오늘')) when = todayIdx;
  else DAYWORDS.forEach((w, i) => { if (w.some(x => s.includes(x))) when = i; });

  const services = P_SERVICE
    .map(([key, words]) => {
      const at = words.map(w => s.indexOf(w)).filter(i => i >= 0);
      return at.length ? { key, at: Math.min(...at) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_SERVICES)
    .map(x => x.key);

  const language = pick(P_LANG);
  const week = /this week|이번\s*주|주중/.test(s);
  let action = pick(P_ACTION);
  if (!action && services.length) action = 'find';
  if ((when !== null || week) && services.length) action = 'book';

  return { raw: String(raw || ''), services, service: services[0] || null,
    language, when, week, action };
}

/** Keep only values we recognise. Anything else is dropped. */
export function sanitize(rawOut) {
  if (!rawOut || typeof rawOut !== 'object') return null;
  const pick = (v, allowed) => (typeof v === 'string' && allowed.includes(v) ? v : null);
  const whenText = typeof rawOut.whenText === 'string' && rawOut.whenText.length <= 40
    ? rawOut.whenText.replace(/[<>]/g, '').trim() || null
    : null;
  const listed = Array.isArray(rawOut.services) ? rawOut.services
    : (rawOut.service ? [rawOut.service] : []);
  const services = [];
  for (const v of listed) {
    const ok = pick(v, SERVICES);
    if (ok && !services.includes(ok)) services.push(ok);
    if (services.length >= MAX_SERVICES) break;
  }
  return {
    services,
    service: services[0] || null,
    language: pick(rawOut.language, LANGUAGES),
    action: pick(rawOut.action, ACTIONS) || 'find',
    whenText,
    urgent: rawOut.urgent === true,
  };
}

/** Strip a ```json fence if a provider adds one despite being asked not to. */
export function parseJsonish(text) {
  const t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(t); } catch { /* fall through */ }
  const m = /\{[\s\S]*\}/.exec(t);
  if (m) { try { return JSON.parse(m[0]); } catch { /* give up */ } }
  return null;
}
