/**
 * Tutoring requests -> structured preferences.
 *
 * The output is a list of constraints, each marked hard or soft, rather than a
 * flat bag of fields. That distinction is the whole design: a hard constraint
 * filters, a soft one scores, and nothing downstream is allowed to trade a
 * hard constraint for a better score. "I absolutely cannot do after 7" must
 * never produce an 8pm recommendation because 8pm happened to be closest.
 *
 * How hardness is decided, in order:
 *   1. The clause says so. "only", "must", "cannot", "no later than" and the
 *      Korean 만/반드시/꼭/절대 make every constraint in that clause hard.
 *      "prefer", "ideally", "if possible" make them soft.
 *   2. Otherwise the type decides. Subject family is hard by default - a maths
 *      tutor cannot help with chemistry however well they score - while day,
 *      time, purpose and specialty are soft: what someone asked for, not what
 *      they said they cannot do without.
 *
 * Clauses are split on punctuation and on "but", and on "and" only when it
 * starts a new thought. Splitting on every "and" would turn "Tuesday and
 * Thursday" into two clauses and lose the connection between them.
 *
 * This is a rule-based extractor, and it is deliberately the floor rather
 * than the ceiling. A model can extract more from messier phrasing, but its
 * output must come back in exactly this shape and pass `normalize()`, the
 * same way intent.js sanitises service names. The rules never hallucinate a
 * subject; a model can.
 */

import { P_LANG } from './intent.js';

/* ------------------------------------------------------------------ subjects */

/**
 * The subject tree. Parents make graded matching possible: a chemistry tutor is
 * a partial match for organic chemistry, a science generalist a weaker one,
 * and a maths tutor no match at all.
 *
 * Words are matched longest-first so "organic chemistry" is never read as
 * plain "chemistry".
 */
export const SUBJECTS = {
  math: { label: 'Math', labelKo: '수학', parent: null, words: ['math', 'maths', 'mathematics', '수학'] },
  algebra: { label: 'Algebra', labelKo: '대수', parent: 'math', words: ['algebra', '대수'] },
  geometry: { label: 'Geometry', labelKo: '기하', parent: 'math', words: ['geometry', '기하'] },
  calculus: { label: 'Calculus', labelKo: '미적분', parent: 'math', words: ['calculus', 'calc', 'derivatives', 'integrals', '미적분'] },
  statistics: { label: 'Statistics', labelKo: '통계', parent: 'math', words: ['statistics', 'stats', '통계'] },
  science: { label: 'Science', labelKo: '과학', parent: null, words: ['science', '과학'] },
  chemistry: { label: 'Chemistry', labelKo: '화학', parent: 'science', words: ['chemistry', 'chem', '화학'] },
  organic_chemistry: { label: 'Organic chemistry', labelKo: '유기화학', parent: 'chemistry', words: ['organic chemistry', 'orgo', 'o-chem', 'ochem', '유기화학'] },
  physics: { label: 'Physics', labelKo: '물리', parent: 'science', words: ['physics', '물리'] },
  biology: { label: 'Biology', labelKo: '생물', parent: 'science', words: ['biology', '생물'] },
  english: { label: 'English', labelKo: '영어', parent: null, words: ['english', 'esl', 'essay', 'writing', '영어'] },
  korean: { label: 'Korean', labelKo: '한국어', parent: null, words: ['korean lessons', 'learn korean', '한국어 수업'] },
};

/** Root-first path, e.g. organic_chemistry -> ['science','chemistry','organic_chemistry']. */
export function subjectPath(key) {
  const path = [];
  let cur = key;
  const guard = new Set();
  while (cur && SUBJECTS[cur] && !guard.has(cur)) {
    guard.add(cur);
    path.unshift(cur);
    cur = SUBJECTS[cur].parent;
  }
  return path;
}

export const isAncestor = (a, b) => a !== b && subjectPath(b).includes(a);

const SUBJECT_WORDS = Object.entries(SUBJECTS)
  .flatMap(([key, s]) => s.words.map((w) => ({ key, w })))
  .sort((x, y) => y.w.length - x.w.length);

/* "Speaks English" asks for a language of instruction, not English lessons. */
const ENGLISH_LANG_SRC = String.raw`\b(?:speaks?|speaking|spoken|talks?)\s+english\b|\benglish[- ]speaking\b|\bin english\b|영어로|영어 가능|영어 하는`;
const ENGLISH_LANG = new RegExp(ENGLISH_LANG_SRC);
const escapeRe = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Subjects named in a clause, in the order they appear.
 *
 * Longer words claim their span first, so "organic chemistry" is never also
 * read as "chemistry" and 유기화학 never also as 화학. The survivors are then
 * ordered by position. The first version ordered them by word length instead,
 * which made "english speaking math tutor" a request for English lessons,
 * because "english" is longer than "math".
 */
function subjectsIn(clause) {
  const taken = [];
  const hits = [];
  let m;
  const lang = new RegExp(ENGLISH_LANG_SRC, 'g');
  while ((m = lang.exec(clause)) !== null) taken.push([m.index, m.index + m[0].length]);
  for (const { key, w } of SUBJECT_WORDS) {
    const re = new RegExp(`(^|[^a-z])${escapeRe(w)}(?![a-z])`, 'g');
    while ((m = re.exec(clause)) !== null) {
      const start = m.index + m[1].length;
      const end = start + w.length;
      if (!taken.some(([a, b]) => start < b && a < end)) {
        taken.push([start, end]);
        hits.push({ key, at: start });
      }
    }
  }
  return [...new Set(hits.sort((a, b) => a.at - b.at).map((h) => h.key))];
}

export const PURPOSES = {
  exam_prep: ['exam', 'test', 'midterm', 'final', 'diploma', 'quiz', 'prepare for', '시험', '수능'],
  homework: ['homework', 'assignment', 'problem set', '숙제', '과제'],
  recurring: ['every week', 'weekly', 'ongoing', 'regular', 'regularly', '매주', '정기'],
  catch_up: ['behind', 'catch up', 'falling', 'struggling', '따라가'],
};

/** Minutes from midnight. Evening ends at 21:00: nobody books a tutor for 23:00. */
export const PERIODS = {
  morning: [6 * 60, 12 * 60],
  afternoon: [12 * 60, 17 * 60],
  evening: [17 * 60, 21 * 60],
};
const PERIOD_WORDS = {
  morning: ['morning', 'mornings', '오전', '아침'],
  afternoon: ['afternoon', 'afternoons', 'after school', '오후'],
  evening: ['evening', 'evenings', 'tonight', 'night', '저녁'],
};

/* JS getDay() numbering: 0 = Sunday. English needs word boundaries ("sun" is
   inside "sunday" and "monitor"); Korean day names do not. */
const DAYS = [
  [0, ['sunday', 'sundays'], ['일요일']],
  [1, ['monday', 'mondays', 'mon'], ['월요일']],
  [2, ['tuesday', 'tuesdays', 'tues', 'tue'], ['화요일']],
  [3, ['wednesday', 'wednesdays', 'wed'], ['수요일']],
  [4, ['thursday', 'thursdays', 'thurs', 'thu'], ['목요일']],
  [5, ['friday', 'fridays', 'fri'], ['금요일']],
  [6, ['saturday', 'saturdays', 'sat'], ['토요일']],
];

const HARD = /\b(only|must|have to|has to|need it to be|cannot|can't|can not|cant|absolutely|no later than|no earlier than|at the latest|at the earliest|strictly|required|never)\b|만 가능|반드시|꼭|절대|안 돼|안돼|불가/;
const SOFT = /\b(prefer|preferably|ideally|would like|i'd like|if possible|rather|would be nice|hopefully|bonus|nice to have)\b|가능하면|선호|좋겠|되면 좋/;
const NEGATIVE = /\b(cannot|can't|can not|cant|not|no|never|unable)\b|안 돼|안돼|불가|못/;
const BROWSE = /what'?s available|what is available|what do you have|show (me )?(what|options|times|everything)|any (times|openings|slots|options)|anything (open|available)|options\?|뭐 있|뭐가 있|가능한 시간|어떤 시간/;

/* --------------------------------------------------------------- clauses */

function clauses(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[.;!?\n]|,|\bbut\b|\band (?=(?:i|i'd|i'm|preferably|ideally|prefer|someone|it|must|only|also)\b)/)
    .map((c) => c.trim())
    .filter(Boolean);
}

function hardnessOf(clause) {
  if (HARD.test(clause)) return 'hard';
  if (SOFT.test(clause)) return 'soft';
  return null;
}

const hasWord = (text, w) => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(text);

/* ------------------------------------------------------------------ times */

/**
 * Parse clock times with the word that governs them ("after 5 pm", "at 6:30").
 * A bare number only counts when a time preposition governs it, so "grade 11"
 * and "2 hours" are never read as times.
 *
 * With no am/pm, 1-7 is afternoon or evening and 8-11 is morning - unless the
 * request names an evening or afternoon, in which case everything is pm. That
 * rule is a guess, and it is a guess about tutoring, where 7am sessions are
 * rare and 7pm ones are common.
 */
function times(clause, periodHint) {
  const out = [];
  const re = /\b(at|around|about|after|before|by|until|till|than|from|between|and|to)?\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?(?![\d:])/g;
  let m;
  while ((m = re.exec(clause)) !== null) {
    const [, prep, hRaw, mRaw, suffix] = m;
    if (!prep && !mRaw && !suffix) continue;
    let h = Number(hRaw);
    const min = mRaw ? Number(mRaw) : 0;
    if (h > 23 || min > 59) continue;
    if (suffix) {
      const pm = /p/.test(suffix);
      if (pm && h < 12) h += 12;
      if (!pm && h === 12) h = 0;
    } else if (h <= 12) {
      if (periodHint === 'evening' || periodHint === 'afternoon') { if (h < 12) h += 12; }
      else if (h >= 1 && h <= 7) h += 12;
    }
    out.push({ prep: prep || null, minutes: h * 60 + min, text: m[0].trim() });
  }
  // Korean: 오후 6시, 저녁 7시 반, 6시 30분. (?!간) keeps 3시간 - three hours -
  // from being read as three o'clock.
  const ko = /(오전|오후|저녁|아침)?\s*(\d{1,2})\s*시(?!간)(?:\s*(\d{1,2})\s*분|\s*(반))?\s*(이후|이전|전|후|부터|까지)?/g;
  while ((m = ko.exec(clause)) !== null) {
    const [, part, hRaw, mRaw, half, rel] = m;
    let h = Number(hRaw);
    const min = mRaw ? Number(mRaw) : half ? 30 : 0;
    if ((part === '오후' || part === '저녁') && h < 12) h += 12;
    else if (!part && h >= 1 && h <= 7) h += 12;
    const prep = rel === '이후' || rel === '후' || rel === '부터' ? 'after'
      : rel === '이전' || rel === '전' || rel === '까지' ? 'before' : 'at';
    out.push({ prep, minutes: h * 60 + min, text: m[0].trim() });
  }
  return out;
}

/* ------------------------------------------------------------------- parse */

/**
 * @param {string} text
 * @returns {{
 *   raw: string, service: 'Tutoring'|null, subject: string|null, specialty: string|null,
 *   purpose: string|null, level: string|null, language: string|null,
 *   durationMin: number|null, browse: boolean, constraints: object[]
 * }}
 */
export function parseTutoringRequest(text) {
  const raw = String(text || '');
  const lower = raw.toLowerCase();
  const parts = clauses(raw);
  const constraints = [];
  const add = (c) => constraints.push(c);

  // A period named anywhere steers am/pm inference everywhere.
  const periodHint = Object.keys(PERIOD_WORDS).find((p) => PERIOD_WORDS[p].some((w) => lower.includes(w))) || null;

  let subject = null;
  let specialty = null;
  let subjectFromPreference = false;

  for (const clause of parts) {
    const stated = hardnessOf(clause);
    const neg = NEGATIVE.test(clause);

    /* subject: the first (most general) subject named is the need; a more
       specific one named in a preference clause is a specialty wish. */
    const found = subjectsIn(clause);
    for (const key of found) {
      if (stated === 'soft' && subject && (isAncestor(subject, key) || key === subject)) {
        specialty = key;
      } else if (!subject) {
        subject = key;
        subjectFromPreference = stated === 'soft';
      } else if (isAncestor(subject, key)) {
        // "chemistry ... organic chemistry" in one breath: keep the family,
        // treat the narrower one as what they would most like.
        specialty = key;
      } else if (isAncestor(key, subject)) {
        specialty = subject;
        subject = key;
      }
    }

    /* days, possibly several: "Tuesday or Thursday" */
    const days = DAYS.filter(([, en, ko]) => en.some((w) => hasWord(clause, w)) || ko.some((w) => clause.includes(w)))
      .map(([d]) => d);
    if (days.length && !neg) {
      add({ type: 'days', value: days, kind: stated === 'hard' ? 'hard' : 'soft', weight: 25, source: clause });
    } else if (days.length && neg) {
      add({ type: 'notDays', value: days, kind: 'hard', weight: 0, source: clause });
    }

    /* period */
    const period = Object.keys(PERIOD_WORDS).find((p) => PERIOD_WORDS[p].some((w) =>
      (/[가-힣]/.test(w) ? clause.includes(w) : hasWord(clause, w))));
    // "오후 6시" names a time, not an afternoon preference.
    const periodIsJustAmPm = period && /[가-힣]/.test(clause) && /(오전|오후)\s*\d/.test(clause);
    if (period && !periodIsJustAmPm) {
      add({ type: 'window', value: PERIODS[period], label: period,
        kind: stated === 'hard' ? 'hard' : 'soft', weight: 12, source: clause });
    }

    /* times */
    const clock = times(clause, periodHint);
    for (let i = 0; i < clock.length; i += 1) {
      const tm = clock[i];
      const p = tm.prep;
      const next = clock[i + 1];
      /* "between 5 and 7", "from 4 to 6": one range, not two times. Read one
         number at a time, the second became a competing target and lost to the
         first, so "between 5 and 7 pm" meant "5 pm, ideally". */
      if ((p === 'between' || p === 'from') && next && (next.prep === 'and' || next.prep === 'to')
          && next.minutes > tm.minutes) {
        const kind = stated === 'hard' ? 'hard' : 'soft';
        add({ type: 'notBefore', value: tm.minutes, kind, weight: 8, source: clause });
        add({ type: 'notAfter', value: next.minutes, kind, weight: 8, source: clause });
        i += 1;
        continue;
      }
      if (p === 'after' || p === 'from') {
        // "after 7" in a negative clause is an upper bound: can't do after 7.
        add({ type: neg ? 'notAfter' : 'notBefore', value: tm.minutes,
          kind: neg || stated === 'hard' ? 'hard' : 'soft', weight: 8, source: clause });
      } else if (p === 'before' || p === 'by' || p === 'until' || p === 'till') {
        add({ type: neg ? 'notBefore' : 'notAfter', value: tm.minutes,
          kind: neg || stated === 'hard' ? 'hard' : 'soft', weight: 8, source: clause });
      } else if (p === 'than' && /later than/.test(clause)) {
        add({ type: 'notAfter', value: tm.minutes, kind: 'hard', weight: 8, source: clause });
      } else if (p === 'than' && /earlier than/.test(clause)) {
        add({ type: 'notBefore', value: tm.minutes, kind: 'hard', weight: 8, source: clause });
      } else {
        add({ type: 'target', value: tm.minutes, kind: 'soft', weight: 20, source: clause });
      }
    }

    /* purpose */
    for (const [key, words] of Object.entries(PURPOSES)) {
      if (words.some((w) => clause.includes(w))) {
        add({ type: 'purpose', value: key, kind: stated === 'hard' ? 'hard' : 'soft', weight: 15, source: clause });
        break;
      }
    }

    /* language of instruction */
    if (ENGLISH_LANG.test(clause)) {
      add({ type: 'language', value: 'English', kind: stated === 'hard' ? 'hard' : 'soft', weight: 10, source: clause });
    }
    for (const [lang, words] of P_LANG) {
      if (words.some((w) => clause.includes(w)) && !/korean lessons|learn korean|한국어 수업/.test(clause)) {
        add({ type: 'language', value: lang, kind: stated === 'hard' ? 'hard' : 'soft', weight: 10, source: clause });
        break;
      }
    }
  }

  /* A subject named only inside a preference ("I'd prefer someone who
     specialises in organic chemistry") is a specialty wish, not a
     requirement. The hard requirement is its family - they still need a
     chemistry tutor - and the narrower subject scores. Without this, the
     preference became a filter and every general chemistry tutor vanished. */
  if (subject && subjectFromPreference && !specialty && SUBJECTS[subject].parent) {
    specialty = subject;
    subject = SUBJECTS[subject].parent;
  }

  if (subject) {
    // The family is hard: no score makes a maths tutor useful for chemistry.
    add({ type: 'subject', value: subject, kind: 'hard', weight: 40, source: 'subject' });
  }
  if (specialty && specialty !== subject) {
    add({ type: 'specialty', value: specialty, kind: 'soft', weight: 20, source: 'specialty' });
  }

  const dur = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h\b|minutes?|mins?)|\b(an|one) hour\b|(\d+)\s*시간|(\d+)\s*분/.exec(lower);
  let durationMin = null;
  if (dur) {
    if (dur[3]) durationMin = 60;
    else if (dur[4]) durationMin = Number(dur[4]) * 60;
    else if (dur[5]) durationMin = Number(dur[5]);
    else durationMin = /h/.test(dur[2]) ? Math.round(Number(dur[1]) * 60) : Number(dur[1]);
  }

  const level = /\bgrade\s*(\d{1,2})\b/.exec(lower) ? `grade ${/\bgrade\s*(\d{1,2})\b/.exec(lower)[1]}`
    : /\b(university|college|undergrad)\b|대학/.test(lower) ? 'university'
    : /\b(high school|highschool)\b|고등/.test(lower) ? 'high school'
    : /\b(middle school|junior high)\b|중학/.test(lower) ? 'middle school' : null;

  const isTutoring = Boolean(subject) || /\b(tutor|tutoring|lesson|lessons|teacher|study help)\b|과외|학원|튜터/.test(lower);
  const purposeC = constraints.find((c) => c.type === 'purpose');
  const langC = constraints.find((c) => c.type === 'language');

  return normalize({
    raw,
    service: isTutoring ? 'Tutoring' : null,
    subject,
    specialty: specialty && specialty !== subject ? specialty : null,
    purpose: purposeC ? purposeC.value : null,
    level,
    language: langC ? langC.value : null,
    durationMin,
    browse: BROWSE.test(lower),
    constraints,
  });
}

/* --------------------------------------------------------------- normalize */

const TYPES = new Set(['days', 'notDays', 'window', 'notBefore', 'notAfter', 'target',
  'subject', 'specialty', 'purpose', 'language', 'duration']);

/**
 * The gate every set of preferences passes through, whoever produced it - the
 * rules above, a model, or the user toggling a chip. Unknown types are
 * dropped, subjects must exist in the tree, times must be real minutes, and
 * duplicates of the same type collapse with hard winning over soft.
 */
export function normalize(prefs) {
  const out = { ...prefs };
  const seen = new Map();
  for (const c of Array.isArray(prefs.constraints) ? prefs.constraints : []) {
    if (!c || !TYPES.has(c.type)) continue;
    const kind = c.kind === 'hard' ? 'hard' : 'soft';
    let value = c.value;
    if (c.type === 'subject' || c.type === 'specialty') {
      if (!SUBJECTS[value]) continue;
    } else if (['notBefore', 'notAfter', 'target'].includes(c.type)) {
      value = Number(value);
      if (!Number.isInteger(value) || value < 0 || value >= 24 * 60) continue;
    } else if (c.type === 'window') {
      if (!Array.isArray(value) || value.length !== 2 || !(value[0] < value[1])) continue;
    } else if (c.type === 'days' || c.type === 'notDays') {
      value = [...new Set((Array.isArray(value) ? value : [value]).map(Number))]
        .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort();
      if (!value.length) continue;
    }
    const key = c.type;
    const prev = seen.get(key);
    const next = { ...c, kind, value, weight: Number(c.weight) || 0 };
    if (!prev || (prev.kind === 'soft' && kind === 'hard')) seen.set(key, next);
    else if (prev.kind === kind && (key === 'days' || key === 'notDays')) {
      seen.set(key, { ...prev, value: [...new Set([...prev.value, ...value])].sort() });
    }
  }
  out.constraints = [...seen.values()];
  return out;
}

/**
 * Carry a conversation forward. "What's available?" is not a new search: it
 * returns the previous preferences untouched. A follow-up that names new
 * constraints replaces constraints of the same type and keeps everything
 * else, so "actually make it Thursday" changes the day and nothing more.
 * "also Thursday" adds a day rather than replacing one.
 */
export function refine(previous, text) {
  const next = parseTutoringRequest(text);
  if (!previous) return next;
  const additive = /\b(also|or also|as well|too)\b|도 /.test(String(text).toLowerCase());
  const hasNew = next.constraints.length > 0;

  if (!hasNew) {
    return { ...previous, browse: next.browse, lastUtterance: next.raw };
  }

  const incomingTypes = new Set(next.constraints.map((c) => c.type));
  let kept = previous.constraints.filter((c) => {
    if (!incomingTypes.has(c.type)) return true;
    return additive && (c.type === 'days' || c.type === 'notDays');
  });
  // A new subject that is a different family resets the specialty; a narrower
  // one within the same family becomes the specialty.
  if (incomingTypes.has('subject') && !incomingTypes.has('specialty')) {
    const oldSubject = previous.subject;
    const newSubject = next.subject;
    if (oldSubject && newSubject && (isAncestor(oldSubject, newSubject))) {
      kept = kept.filter((c) => c.type !== 'subject' && c.type !== 'specialty');
      next.constraints = next.constraints.filter((c) => c.type !== 'subject');
      next.constraints.push({ type: 'subject', value: oldSubject, kind: 'hard', weight: 40, source: 'subject' });
      next.constraints.push({ type: 'specialty', value: newSubject, kind: 'soft', weight: 20, source: 'specialty' });
    } else {
      kept = kept.filter((c) => c.type !== 'specialty');
    }
  }

  const merged = normalize({
    ...previous,
    ...Object.fromEntries(Object.entries(next).filter(([k, v]) => v !== null && k !== 'constraints' && k !== 'raw')),
    constraints: [...kept, ...next.constraints],
    lastUtterance: next.raw,
  });
  const subj = merged.constraints.find((c) => c.type === 'subject');
  const spec = merged.constraints.find((c) => c.type === 'specialty');
  merged.subject = subj ? subj.value : null;
  merged.specialty = spec ? spec.value : null;
  merged.raw = previous.raw;
  return merged;
}
