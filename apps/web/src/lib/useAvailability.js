/**
 * Availability state, day by day.
 *
 * Rules this hook holds, each of them a bug that happened once:
 *
 *   A slot is a time on a date. Keyed by day offset, never a bare clock label.
 *
 *   The server outranks the sample data. Once /api/availability answers, its
 *   tier wins over the record's own `av`, and its slots replace the stand-in
 *   for every day of the horizon - including days it says are empty. Filling
 *   only the days that had slots left invented Saturday times showing beside
 *   a server that said the business is closed on Saturday.
 *
 *   Live changes are only simulated for a live calendar. Nothing can know a
 *   slot was "just taken" at a business that only published usual hours, so
 *   `watch` is for connected businesses and the caller enforces that.
 *
 *   Side effects stay out of state updaters. React may run an updater twice
 *   (StrictMode does, deliberately), and handing a cancelled slot to the next
 *   person in the standby line is a side effect: decided inside the updater,
 *   one cancellation could reach two people.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { slots as S } from '@lonera/core';

const TICK_MS = 9000;
/** Share of ticks that cancel rather than book, so the standby queue can fire. */
const CANCEL_CHANCE = 0.45;

const dayKey = (bizId, day) => `${bizId}|${day | 0}`;
const sampleDay = (bizId, day, tier) => ({
  open: tier === 'unknown' ? [] : S.sampleSlots(bizId, day), taken: [], won: [],
});

export function useAvailability() {
  const [state, setState] = useState({});             // "biz|day" -> {open,taken,won}
  const [serverTier, setServerTier] = useState({});   // bizId -> tier the server reported
  const stateRef = useRef(state);
  const timer = useRef(null);

  useEffect(() => { stateRef.current = state; }, [state]);

  const dayOf = useCallback(
    (bizId, day, tier) => state[dayKey(bizId, day)] || sampleDay(bizId, day, tier),
    [state],
  );

  /** Make sure a business/day exists in state before anything mutates it. */
  const ensure = useCallback((bizId, day, tier) => {
    const k = dayKey(bizId, day);
    setState((prev) => (prev[k] ? prev : { ...prev, [k]: sampleDay(bizId, day, tier) }));
  }, []);

  /** Ask the server. Its tier is recorded even when it has no slots to give. */
  const refresh = useCallback(async (biz) => {
    try {
      const r = await fetch(`/api/availability/${encodeURIComponent(biz.id)}`, {
        headers: { Accept: 'application/json' },
      });
      if (!r.ok) return false;
      const d = await r.json();
      if (!d || typeof d.tier !== 'string') return false;
      setServerTier((prev) => ({ ...prev, [biz.id]: d.tier }));
      if (!Array.isArray(d.slots)) return true;

      const today = S.dayAt(0).getTime();
      const byDay = {};
      for (const ms of d.slots) {
        const when = new Date(ms);
        if (Number.isNaN(+when)) continue;
        const midnight = new Date(when);
        midnight.setHours(0, 0, 0, 0);
        const off = Math.round((midnight.getTime() - today) / 86400000);
        if (off < 0 || off >= S.HORIZON_DAYS) continue;
        const label = S.canonicalLabel(when);
        if (label) (byDay[off] = byDay[off] || []).push(label);
      }
      setState((prev) => {
        const next = { ...prev };
        for (let off = 0; off < S.HORIZON_DAYS; off += 1) {
          next[dayKey(biz.id, off)] = { open: (byDay[off] || []).slice(0, 14), taken: [], won: [] };
        }
        return next;
      });
      return true;
    } catch {
      return false;   // artifact CSP and offline both land here
    }
  }, []);

  /**
   * A slot going while you look at it, and a cancellation reaching whoever was
   * first in line. Decided once per tick, outside any state updater.
   */
  const watch = useCallback((bizId, day, { onCancel } = {}) => {
    if (timer.current) clearInterval(timer.current);
    const k = dayKey(bizId, day);
    timer.current = setInterval(() => {
      const cur = stateRef.current[k];
      if (!cur) return;
      if (cur.taken.length && Math.random() < CANCEL_CHANCE) {
        const back = cur.taken[0];
        const mine = onCancel ? Boolean(onCancel(back)) : false;
        setState((prev) => {
          const c = prev[k];
          if (!c || c.taken[0] !== back) return prev;
          const taken = c.taken.slice(1);
          return {
            ...prev,
            [k]: mine
              ? { ...c, taken, won: [back, ...c.won] }
              : { ...c, taken, open: [...c.open, back].sort(S.bySlotTime) },
          };
        });
        return;
      }
      if (!cur.open.length) return;
      const gone = cur.open[Math.floor(Math.random() * cur.open.length)];
      setState((prev) => {
        const c = prev[k];
        if (!c || !c.open.includes(gone)) return prev;
        return { ...prev, [k]: { ...c, open: c.open.filter((x) => x !== gone), taken: [gone, ...c.taken].slice(0, 3) } };
      });
    }, TICK_MS);
  }, []);

  const unwatch = useCallback(() => {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
  }, []);

  useEffect(() => unwatch, [unwatch]);

  const tierOf = useCallback(
    (biz) => (biz ? (serverTier[biz.id] || biz.av || 'unknown') : 'unknown'),
    [serverTier],
  );
  const isLive = useCallback((bizId) => serverTier[bizId] === 'connected', [serverTier]);
  /** True once the server has answered for this business - the times are not a stand-in. */
  const answered = useCallback((bizId) => Boolean(serverTier[bizId]), [serverTier]);

  return useMemo(
    () => ({ dayOf, ensure, refresh, watch, unwatch, tierOf, isLive, answered }),
    [dayOf, ensure, refresh, watch, unwatch, tierOf, isLive, answered],
  );
}
