/**
 * Matching and ranking.
 *
 * Two passes, and the order between them is the rule this module exists to
 * enforce:
 *
 *   1. Filter. Every hard constraint must hold, plus the structural ones the
 *      user never has to say: the slot is open, it is far enough away to
 *      actually get there, and it does not collide with their own calendar.
 *      A slot that fails any of these is gone. It is never scored, so no
 *      amount of soft fit can bring it back.
 *   2. Score. Soft constraints add points. Ties break toward the earlier
 *      start, which is how "5:30 before 6:30" falls out of two equally close
 *      alternatives to a 6:00 request.
 *
 * The weights, and why they sit where they do:
 *
 *   subject     exact 40, a specialist 32, a broader tutor 12 (one level up)
 *               or 4 (two). A science generalist is a real but weak answer to
 *               "organic chemistry".
 *   specialty   20  - stated as a preference, so it can outweigh a day but
 *               never a missing subject.
 *   day         25 on a requested day; a neighbouring day 10, fading.
 *   target      up to 20 by closeness, +5 exactly on time, on the requested day.
 *   purpose     15
 *   window      12 inside the period, fading out over two hours.
 *   language    10
 *   bounds      8 for respecting "after 5", +up to 4 for being soon after it.
 *   history     6 for a tutor they have booked before.
 *   rating      up to 5 - enough to break a near-tie, never enough to decide.
 *
 * These were tuned against the two worked examples in the brief, and both are
 * pinned as tests. Change a weight and the tests say which example broke.
 *
 * Every point awarded comes back as a reason, so the UI can say *why* a result
 * is where it is. A ranking the user cannot inspect is a ranking they cannot
 * correct.
 */

import { SUBJECTS, subjectPath, isAncestor } from './tutoring.js';

/** Nobody can get across Calgary in less than this after tapping "book". */
export const MIN_LEAD_MS = 2 * 60 * 60 * 1000;

const DAY_MS = 86400000;
const minutesOfDay = (d) => d.getHours() * 60 + d.getMinutes();

function endMinutes(start, end) {
  // A session that runs past midnight ends "after" any same-day bound.
  const sameDay = start.getFullYear() === end.getFullYear()
    && start.getMonth() === end.getMonth() && start.getDate() === end.getDate();
  return sameDay ? minutesOfDay(end) : 24 * 60 + minutesOfDay(end);
}

/** Circular weekday distance: Friday is one day from Thursday. */
function nearestDayGap(date, days) {
  const d = date.getDay();
  return Math.min(...days.map((x) => {
    const diff = Math.abs(d - x);
    return Math.min(diff, 7 - diff);
  }));
}

/** How well one tutor covers a requested subject, or null for not at all. */
export function subjectFit(tutor, requested) {
  let best = null;
  for (const t of tutor.subjects || []) {
    let fit = null;
    if (t === requested) fit = { level: 'exact', points: 40 };
    else if (isAncestor(requested, t)) fit = { level: 'specialist', points: 32 };
    else if (isAncestor(t, requested)) {
      const gap = subjectPath(requested).length - subjectPath(t).length;
      fit = { level: 'broader', points: gap === 1 ? 12 : 4 };
    }
    if (fit && (!best || fit.points > best.points)) best = { ...fit, via: t };
  }
  return best;
}

/**
 * Evaluate one candidate slot against preferences.
 *
 * @param {object} slot   { id, tutor, start, end, status }
 * @param {object} prefs  output of parseTutoringRequest / refine
 * @param {object} opts   { now, userBusy: [[start,end],...], leadMs, history: { tutors: [] } }
 */
export function evaluate(slot, prefs, opts = {}) {
  const now = opts.now ?? Date.now();
  const leadMs = opts.leadMs ?? MIN_LEAD_MS;
  const userBusy = opts.userBusy || [];
  const history = opts.history || {};
  const tutor = slot.tutor || {};
  const start = new Date(slot.start);
  const end = new Date(slot.end);
  const constraints = (prefs && prefs.constraints) || [];

  const violations = [];
  const reasons = [];
  let score = 0;
  const award = (code, points, value) => {
    if (points <= 0) return;
    score += points;
    reasons.push({ code, points: Math.round(points * 100) / 100, value });
  };
  const fail = (code, constraint) => violations.push({ code, constraint: constraint || null });

  /* structural - never negotiable, never stated */
  if (Number.isNaN(+start) || Number.isNaN(+end) || !(+end > +start)) fail('invalid_slot');
  if (slot.status && slot.status !== 'open') fail('not_open');
  if (+start < now + leadMs) fail('too_soon');
  for (const [b0, b1] of userBusy) {
    if (+start < +new Date(b1) && +new Date(b0) < +end) { fail('your_calendar'); break; }
  }

  const sMin = minutesOfDay(start);
  const eMin = endMinutes(start, end);

  for (const c of constraints) {
    const hard = c.kind === 'hard';
    switch (c.type) {
      case 'subject': {
        const fit = subjectFit(tutor, c.value);
        if (!fit) fail('subject', c);
        else award(`subject_${fit.level}`, fit.points, fit.via);
        break;
      }
      case 'specialty': {
        const has = (tutor.subjects || []).includes(c.value) || (tutor.specialties || []).includes(c.value);
        if (has) award('specialty', c.weight, c.value);
        else if (hard) fail('specialty', c);
        break;
      }
      case 'days': {
        if (c.value.includes(start.getDay())) award('day', c.weight);
        else if (hard) fail('day', c);
        else {
          const away = nearestDayGap(start, c.value);
          award('day_nearby', Math.max(0, 10 - 4 * (away - 1)), away);
        }
        break;
      }
      case 'notDays':
        if (c.value.includes(start.getDay())) fail('day_excluded', c);
        break;
      case 'window': {
        const [w0, w1] = c.value;
        if (sMin >= w0 && eMin <= w1) award('window', c.weight, c.label);
        else if (hard) fail('window', c);
        else {
          const dist = sMin < w0 ? w0 - sMin : Math.max(0, eMin - w1);
          award('window_near', c.weight * Math.max(0, 1 - dist / 120), c.label);
        }
        break;
      }
      case 'notBefore':
        if (sMin >= c.value) {
          award('after_bound', c.weight + 4 * Math.max(0, 1 - (sMin - c.value) / 180));
        } else if (hard) fail('too_early', c);
        break;
      case 'notAfter':
        // Applied to the END of the session: "I can't attend after 7" means
        // they are gone at 7, so a 6:30 hour-long session does not fit.
        if (eMin <= c.value) award('before_bound', c.weight);
        else if (hard) fail('too_late', c);
        break;
      case 'purpose':
        if ((tutor.purposes || []).includes(c.value)) award('purpose', c.weight, c.value);
        else if (hard) fail('purpose', c);
        break;
      case 'language':
        if ((tutor.languages || []).includes(c.value)) award('language', c.weight, c.value);
        else if (hard) fail('language', c);
        break;
      case 'duration': {
        const mins = Math.round((+end - +start) / 60000);
        if (mins === c.value) award('duration', 5, mins);
        else if (hard) fail('duration', c);
        break;
      }
      default:
        break;   // 'target' is scored below, once the day is known
    }
  }

  /* target time: closeness counts on the requested day(s), or any day when
     no day was named. "6pm" on the wrong day is not "close to 6pm". */
  let delta = null;
  const target = constraints.find((c) => c.type === 'target');
  if (target) {
    const days = constraints.find((c) => c.type === 'days');
    if (!days || days.value.includes(start.getDay())) {
      delta = Math.abs(sMin - target.value);
      const w = target.weight || 20;
      award(delta === 0 ? 'exact_time' : 'near_time', w * Math.max(0, 1 - delta / 180) + (delta === 0 ? 5 : 0), delta);
    }
  }

  const rating = Number(tutor.rating) || 0;
  award('rating', Math.max(0, Math.min(5, (rating - 4) * 5)), rating);
  if (Array.isArray(history.tutors) && history.tutors.includes(tutor.id)) award('booked_before', 6);

  return {
    ok: violations.length === 0,
    violations,
    score: Math.round(score * 100) / 100,
    reasons,
    minutesFromTarget: delta,
  };
}

/**
 * Rank candidate slots. Returns the matches, a count of what was filtered out
 * and why, and - only when nothing matched - which hard constraints would
 * reveal results if loosened. It never loosens one itself: turning a "must"
 * into a "maybe" is the user's call, not the ranker's.
 */
export function rank(slots, prefs, opts = {}) {
  const evaluated = slots.map((slot) => ({ slot, ...evaluate(slot, prefs, opts) }));
  const matches = evaluated
    .filter((e) => e.ok)
    .sort((a, b) => (b.score - a.score)
      || (+new Date(a.slot.start) - +new Date(b.slot.start))
      || String(a.slot.tutor && a.slot.tutor.id).localeCompare(String(b.slot.tutor && b.slot.tutor.id)));

  const excluded = {};
  for (const e of evaluated) {
    if (e.ok) continue;
    for (const v of e.violations) excluded[v.code] = (excluded[v.code] || 0) + 1;
  }

  return {
    matches,
    excluded,
    total: slots.length,
    relaxations: matches.length ? [] : suggestRelaxations(slots, prefs, opts),
  };
}

/** Which single hard constraint, made soft, would reveal the most results. */
export function suggestRelaxations(slots, prefs, opts = {}) {
  const hard = (prefs.constraints || []).filter((c) => c.kind === 'hard' && c.type !== 'subject');
  return hard
    .map((c) => {
      const loosened = {
        ...prefs,
        constraints: prefs.constraints.map((x) => (x === c ? { ...x, kind: 'soft' } : x)),
      };
      const n = slots.filter((s) => evaluate(s, loosened, opts).ok).length;
      return { constraint: c, wouldReveal: n };
    })
    .filter((r) => r.wouldReveal > 0)
    .sort((a, b) => b.wouldReveal - a.wouldReveal);
}

/**
 * Candidates for the Swap screen.
 *
 * Swap is not "replace with the next one". It re-runs the ranking with the
 * original request intact, anchored on the booking the user already has: the
 * current time becomes a soft target and its day a soft day, so alternatives
 * near what they chose rank first. Hard constraints carry over unchanged. The
 * current slot is excluded; other times with the same tutor are not, because
 * "same tutor, half an hour later" is often exactly the swap someone wants.
 */
export function swapCandidates(slots, prefs, current, opts = {}) {
  const at = new Date(current.start);
  const anchored = {
    ...prefs,
    constraints: [
      ...(prefs.constraints || []).filter((c) => (c.kind === 'hard') || (c.type !== 'target' && c.type !== 'days')),
      ...((prefs.constraints || []).some((c) => c.type === 'days' && c.kind === 'hard')
        ? []
        : [{ type: 'days', value: [at.getDay()], kind: 'soft', weight: 25, source: 'current booking' }]),
      { type: 'target', value: minutesOfDay(at), kind: 'soft', weight: 20, source: 'current booking' },
    ],
  };
  const others = slots.filter((s) => !(s.tutor && current.tutorId === s.tutor.id
    && +new Date(s.start) === +new Date(current.start)));
  const out = rank(others, anchored, opts);
  out.matches = out.matches.map((m) => ({
    ...m,
    sameTutor: Boolean(m.slot.tutor && m.slot.tutor.id === current.tutorId),
  }));
  return out;
}

/** One card per tutor with their best few times - the list the Swap screen shows. */
export function groupByTutor(matches, perTutor = 3) {
  const groups = new Map();
  for (const m of matches) {
    const id = m.slot.tutor && m.slot.tutor.id;
    if (!groups.has(id)) groups.set(id, { tutor: m.slot.tutor, best: m, times: [] });
    const g = groups.get(id);
    if (g.times.length < perTutor) g.times.push(m);
  }
  return [...groups.values()];
}

/**
 * What changed between two rankings of the same request, so the results
 * screen can show a slot being taken instead of silently reshuffling under
 * the user's thumb.
 */
export function diffRankings(before, after) {
  const key = (m) => m.slot.id;
  const prev = new Map(before.map((m, i) => [key(m), i]));
  const next = new Map(after.map((m, i) => [key(m), i]));
  return {
    removed: before.filter((m) => !next.has(key(m))).map(key),
    added: after.filter((m) => !prev.has(key(m))).map(key),
    moved: after.filter((m) => prev.has(key(m)) && prev.get(key(m)) !== next.get(key(m)))
      .map((m) => ({ id: key(m), from: prev.get(key(m)), to: next.get(key(m)) })),
  };
}

export { SUBJECTS, DAY_MS };
