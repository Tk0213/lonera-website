/**
 * Slot arithmetic and the day model.
 *
 * The rule this module exists to hold: **a time is a time on a date.** Slots
 * used to be bare clock labels, which meant three "non-colliding" times in one
 * plan could sit on three different days while reading as one afternoon. That
 * is the same class of error as showing "Free today" for a business with no
 * schedule, except this one costs someone a day off work.
 *
 * The label stays canonical and English (`"2:30 PM"`) because it is used as a
 * key - the taken list and the standby queue are both keyed on it. Only the
 * *display* is localised, by `formatSlot`. Rewriting labels per language would
 * silently change every queue key the moment somebody switched language and
 * drop them out of lines they were standing in.
 */

/** The working day, in canonical labels. Lunch is deliberately absent. */
export const SLOT_LABELS = [
  '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
  '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM',
  '4:00 PM', '4:30 PM',
];

export const SLOT_MINUTES = 30;
export const HORIZON_DAYS = 7;

/** Midnight, `offset` days from now. */
export function dayAt(offset, now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() + (offset | 0));
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Canonical label -> minutes from midnight, or null if unparseable. */
export function slotMinutes(label) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(label));
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (/pm/i.test(m[3])) h += 12;
  return h * 60 + Number(m[2]);
}

/** Order two labels by clock time, for sorting a slot list. */
export const bySlotTime = (a, b) => (slotMinutes(a) ?? 0) - (slotMinutes(b) ?? 0);

/** A slot on a day, as a real Date. */
export function slotDate(offset, label, now = new Date()) {
  const mins = slotMinutes(label);
  if (mins == null) return null;
  const d = dayAt(offset, now);
  d.setMinutes(mins);
  return d;
}

/**
 * A Date -> the canonical label.
 *
 * Built by hand rather than with toLocaleTimeString, because the canonical
 * label is a *key* and must not depend on a locale or an ICU version. Node's
 * en-CA renders "9:30 a.m.", which does not match the SLOT_LABELS form, so
 * every label coming back from the server silently stopped matching the ones
 * the standby queue was keyed on - and Korean fell back to showing "a.m."
 * because the display formatter could not parse it either.
 */
export function canonicalLabel(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(+d)) return null;
  const h = d.getHours();
  const suffix = h < 12 ? 'AM' : 'PM';
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${suffix}`;
}

/** Display form. Korean reads 오전/오후, and the label itself never changes. */
export function formatSlot(label, lang) {
  if (lang !== 'ko') return label;
  const mins = slotMinutes(label);
  if (mins == null) return label;
  const h = Math.floor(mins / 60);
  const mm = String(mins % 60).padStart(2, '0');
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${mm}`;
}

/** "Today" / "Tomorrow" / a real date, in the reader's language. */
export function formatDay(offset, lang, t, now = new Date()) {
  const o = offset | 0;
  if (o === 0) return t ? t('avToday') : 'Today';
  if (o === 1) return t ? t('avTomorrow') : 'Tomorrow';
  return dayAt(o, now).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-CA',
    { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Deterministic stand-in availability for one business on one day.
 *
 * Deterministic on purpose: reopening a sheet must not reshuffle the times
 * under the person reading them, and "3rd in line" has to mean the same thing
 * after a repaint. This is the only part of the availability feature that is
 * invented, and every surface that shows it says so.
 */
export function sampleSlots(bizId, dayOffset) {
  const key = `${bizId}|${dayOffset | 0}`;
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return SLOT_LABELS.filter((_, i) => ((h >> (i % 16)) & 1) === 0);
}

/**
 * Cut open windows into slot-sized steps, dropping any that collide with busy
 * time or sit in the past. Milliseconds in, milliseconds out.
 */
export function sliceFree(openWindows, busy, slotMs = SLOT_MINUTES * 60000, nowMs = Date.now()) {
  const out = [];
  for (const [ws, we] of openWindows) {
    for (let t = ws; t + slotMs <= we; t += slotMs) {
      if (t < nowMs) continue;
      const clash = busy.some(([bs, be]) => t < be && t + slotMs > bs);
      if (!clash) out.push(t);
    }
  }
  return out;
}

/**
 * Open windows from declared recurring hours.
 * `hours` is `{ 0..6: [["09:00","17:00"], ...] }`, keyed by JS getDay().
 */
export function windowsFromDeclared(hours, date) {
  const spec = hours && hours[String(date.getDay())];
  if (!Array.isArray(spec)) return [];
  const out = [];
  for (const pair of spec) {
    if (!Array.isArray(pair) || pair.length !== 2) continue;
    const mk = (hhmm) => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm));
      if (!m) return null;
      const d = new Date(date);
      d.setHours(Number(m[1]), Number(m[2]), 0, 0);
      return d.getTime();
    };
    const s = mk(pair[0]);
    const e = mk(pair[1]);
    if (s != null && e != null && e > s) out.push([s, e]);
  }
  return out;
}
