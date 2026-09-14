/**
 * Standby queue, wrapping @lonera/core.
 *
 * The queue itself is core's, so the order rule is not reimplemented here -
 * it was reimplemented once before, in the prototype, and two copies of a
 * fairness rule needed two test files to keep honest. This hook only holds
 * the instance and re-renders when it changes.
 *
 * Other people are seeded into each line deterministically, because "3rd in
 * line" has to mean the same thing after a repaint, and a queue that is always
 * empty teaches the user the wrong thing about how busy a slot is.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { createWaitlist, MAX_PER_USER } from '@lonera/core';

const ME = 'me';

function seedCount(bizId, day, slot) {
  const k = `${bizId}|${day}|${slot}`;
  let h = 0;
  for (let i = 0; i < k.length; i += 1) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  return h % 3;                                  // 0-2 people already waiting
}

export function useStandby() {
  const wl = useRef(useMemo(() => createWaitlist(), [])).current;
  const [version, bump] = useState(0);
  const seeded = useRef(new Set());

  const ensureSeeded = useCallback((bizId, day, slot) => {
    const k = `${bizId}|${day}|${slot}`;
    if (seeded.current.has(k)) return;
    seeded.current.add(k);
    const n = seedCount(bizId, day, slot);
    for (let i = 0; i < n; i += 1) wl.join(bizId, day, slot, `other${i}`);
  }, [wl]);

  const join = useCallback((bizId, day, slot) => {
    ensureSeeded(bizId, day, slot);
    const out = wl.join(bizId, day, slot, ME);
    bump((v) => v + 1);
    return out;
  }, [wl, ensureSeeded]);

  const leave = useCallback((bizId, day, slot) => {
    const out = wl.leave(bizId, day, slot, ME);
    bump((v) => v + 1);
    return out;
  }, [wl]);

  /** A cancellation. Returns true when it reached this user. */
  const release = useCallback((bizId, day, slot) => {
    const out = wl.release(bizId, day, slot);
    bump((v) => v + 1);
    return Boolean(out.claimed && out.claimed.userId === ME);
  }, [wl]);

  const info = useCallback((bizId, day, slot) => {
    ensureSeeded(bizId, day, slot);
    return {
      position: wl.position(bizId, day, slot, ME),
      length: wl.length(bizId, day, slot),
    };
  }, [wl, ensureSeeded]);

  return { join, leave, release, info, max: MAX_PER_USER, version };
}
