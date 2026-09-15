/**
 * The multi-service plan.
 *
 * "I need a plumber, a cleaner and an electrician this week who speaks Korean"
 * is one errand, not three searches. This picks one business per trade and one
 * time each, all on a single day, with no two visits colliding - one afternoon
 * off work rather than three half-days is the entire reason to bundle.
 *
 * It refuses to flatten the tiers. A connected business yields a bookable
 * slot, a declared one a time to request, and one with no schedule gets no
 * time at all. Three confirmed times when two were guesses would cost someone
 * a day off work.
 */
import { useCallback, useState } from 'react';
import { businesses, ranking, slots as S } from '@lonera/core';

const MAX_ROWS = 4;

function candidates(service, language) {
  const pool = businesses.byCategory(service);
  const spoken = language ? pool.filter((b) => (b.lg || []).includes(language)) : [];
  // Prefer the language, but never return nothing because of it.
  return ranking.order(spoken.length ? spoken : pool, { language: language || 'English' });
}

export function buildPlan(parsed, { held = {}, dayOf, tierOf } = {}) {
  const wanted = (parsed.services && parsed.services.length
    ? parsed.services
    : (parsed.service ? [parsed.service] : [])).slice(0, MAX_ROWS);
  if (!wanted.length) return null;

  const rows = wanted.map((service) => {
    const list = candidates(service, parsed.language);
    const keep = held[service] && list.find((b) => b.id === held[service]);
    return { service, biz: keep || list[0] || null, alternatives: list, slot: null, open: [] };
  });

  const openFor = (biz, day) => {
    if (!biz) return [];
    const d = dayOf ? dayOf(biz.id, day, tierOf ? tierOf(biz) : biz.av) : null;
    return d ? d.open.filter((x) => !d.taken.includes(x)) : [];
  };

  /* A named weekday wins outright. Otherwise the soonest day on which the most
     of the errand can actually happen. */
  let day = 0;
  if (parsed.when !== null && parsed.when !== undefined) {
    for (let o = 0; o < S.HORIZON_DAYS; o += 1) {
      if (((S.dayAt(o).getDay() + 6) % 7) === parsed.when) { day = o; break; }
    }
  } else {
    let best = -1;
    for (let o = 0; o < S.HORIZON_DAYS; o += 1) {
      const n = rows.filter((r) => openFor(r.biz, o).length).length;
      if (n > best) { best = n; day = o; }
      if (n === rows.length) break;
    }
  }

  rows.forEach((r) => { r.open = openFor(r.biz, day); });

  /* Most constrained first: a business with two open times has to choose
     before one with ten, or the flexible one takes the slot they both wanted
     and the tight one is left with nothing. */
  const used = new Set();
  [...rows].sort((a, b) => a.open.length - b.open.length).forEach((r) => {
    r.slot = r.open.find((x) => !used.has(x)) || null;
    if (r.slot) used.add(r.slot);
  });

  rows.sort((a, b) => (a.slot ? S.slotMinutes(a.slot) : 1e9) - (b.slot ? S.slotMinutes(b.slot) : 1e9));
  // `when` and `week` travel with the plan so a swap re-plans the day that was
  // asked for. Swap used to rebuild with when: null, quietly moving a
  // "Tuesday" errand to whichever day scored best.
  return { rows, day, language: parsed.language, raw: parsed.raw,
    when: parsed.when ?? null, week: Boolean(parsed.week) };
}

export function tallyPlan(plan, tierOf) {
  const n = { connected: 0, declared: 0, unknown: 0 };
  plan.rows.forEach((r) => {
    if (!r.biz) return;
    n[r.slot ? (tierOf ? tierOf(r.biz) : r.biz.av) : 'unknown'] += 1;
  });
  return n;
}

export function usePlan() {
  const [plan, setPlan] = useState(null);
  const open = useCallback((parsed, opts) => {
    const built = buildPlan(parsed, opts);
    setPlan(built);
    return built;
  }, []);
  const close = useCallback(() => setPlan(null), []);
  return { plan, open, close, setPlan };
}
