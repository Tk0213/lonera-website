/**
 * Availability state, day by day.
 *
 * Three things this hook is careful about, each of them a bug that already
 * happened once in this project:
 *
 *   A slot is a time on a date. Keyed by day offset, never a bare clock label,
 *   because three "non-colliding" times on three different days read as one
 *   afternoon and are not one.
 *
 *   Only a real feed may be called live. `fromServer` is set when
 *   /api/availability answered; until then these times are a labelled
 *   stand-in and every surface that shows them says so. Claiming "straight
 *   from their calendar" over invented times is the exact dishonesty the
 *   tier model exists to prevent.
 *
 *   The live timer stops when nothing is watching. A background interval
 *   repainting a closed sheet is a leak, and it also keeps taking slots the
 *   user can no longer see.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { slots as S } from '@lonera/core';

const TICK_MS = 9000;
/** Half of ticks cancel rather than book, so the standby queue can fire. */
const CANCEL_CHANCE = 0.45;

const dayKey = (bizId, day) => `${bizId}|${day | 0}`;

export function useAvailability() {
  const [state, setState] = useState({});      // "biz|day" -> {open,taken,won}
  const [fromServer, setFromServer] = useState({});
  const [serverTier, setServerTier] = useState({});
  const timer = useRef(null);

  const dayOf = useCallback((bizId, day, tier) => {
    const k = dayKey(bizId, day);
    const found = state[k];
    if (found) return found;
    return { open: tier === 'unknown' ? [] : S.sampleSlots(bizId, day), taken: [], won: [] };
  }, [state]);

  /** Make sure a business/day exists in state before anything mutates it. */
  const ensure = useCallback((bizId, day, tier) => {
    const k = dayKey(bizId, day);
    setState((prev) => (prev[k] ? prev : {
      ...prev,
      [k]: { open: tier === 'unknown' ? [] : S.sampleSlots(bizId, day), taken: [], won: [] },
    }));
  }, []);

  /** Try the real endpoint. Only a `connected` answer earns the live label. */
  const refresh = useCallback(async (biz) => {
    try {
      const r = await fetch(`/api/availability/${encodeURIComponent(biz.id)}`, {
        headers: { Accept: 'application/json' },
      });
      if (!r.ok) return false;
      const d = await r.json();
      if (!d || typeof d.tier !== 'string') return false;
      if (!Array.isArray(d.slots) || !d.slots.length) return false;
      // Real timestamps: file each under its own day rather than flattening
      // them into one list of clock times.
      const today = S.dayAt(0).getTime();
      const byDay = {};
      for (const ms of d.slots) {
        const when = new Date(ms);
        if (Number.isNaN(+when)) continue;
        const midnight = new Date(when); midnight.setHours(0, 0, 0, 0);
        const off = Math.round((midnight.getTime() - today) / 86400000);
        if (off < 0 || off >= S.HORIZON_DAYS) continue;
        const label = S.canonicalLabel(when);
        if (label) (byDay[off] = byDay[off] || []).push(label);
      }
      setState((prev) => {
        const next = { ...prev };
        for (const [off, list] of Object.entries(byDay)) {
          next[dayKey(biz.id, off)] = { open: list.slice(0, 14), taken: [], won: [] };
        }
        return next;
      });
      /* The server's answer outranks the record's own `av` field. bowriver is
         marked connected in the sample data but has no ICS_URL configured, so
         the resolver correctly reports `declared` - and the sheet should say
         declared rather than carrying a live badge over requested times. */
      setFromServer((prev) => ({ ...prev, [biz.id]: d.tier === 'connected' }));
      setServerTier((prev) => ({ ...prev, [biz.id]: d.tier }));
      return true;
    } catch {
      return false;   // artifact CSP and offline both land here
    }
  }, []);

  /**
   * The behaviour the whole feature exists to show: a slot going while you
   * are looking at it, and a cancellation reaching whoever was first in line.
   */
  const watch = useCallback((bizId, day, { onCancel } = {}) => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setState((prev) => {
        const k = dayKey(bizId, day);
        const cur = prev[k];
        if (!cur) return prev;
        if (cur.taken.length && Math.random() < CANCEL_CHANCE) {
          const [back, ...restTaken] = cur.taken;
          const claimedByMe = onCancel ? onCancel(back) : false;
          return {
            ...prev,
            [k]: claimedByMe
              ? { ...cur, taken: restTaken, won: [back, ...cur.won] }
              : { ...cur, taken: restTaken, open: [...cur.open, back].sort(S.bySlotTime) },
          };
        }
        if (!cur.open.length) return prev;
        const i = Math.floor(Math.random() * cur.open.length);
        const gone = cur.open[i];
        return {
          ...prev,
          [k]: {
            ...cur,
            open: cur.open.filter((_, n) => n !== i),
            taken: [gone, ...cur.taken].slice(0, 3),
          },
        };
      });
    }, TICK_MS);
  }, []);

  const unwatch = useCallback(() => {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
  }, []);

  // Nothing should outlive the component that asked for it.
  useEffect(() => unwatch, [unwatch]);

  const take = useCallback((bizId, day, label) => {
    setState((prev) => {
      const k = dayKey(bizId, day);
      const cur = prev[k];
      if (!cur) return prev;
      return { ...prev, [k]: { ...cur, open: cur.open.filter((x) => x !== label),
        taken: [label, ...cur.taken].slice(0, 3) } };
    });
  }, []);

  return { dayOf, ensure, refresh, watch, unwatch, take,
    isLive: (bizId) => Boolean(fromServer[bizId]),
    /** The tier to believe: what the server said, else the sample record. */
    tierOf: (biz) => (biz ? (serverTier[biz.id] || biz.av || 'unknown') : 'unknown') };
}
