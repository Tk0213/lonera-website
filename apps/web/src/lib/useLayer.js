/**
 * A layer on top of the page: a sheet, the plan screen.
 *
 * Two behaviours every layer needs, and one each had to get right by hand
 * before this existed:
 *
 *   Escape closes the top layer only. Every layer used to listen on document
 *   for itself, so with Swap open over the plan, one Escape closed both - and
 *   the plan's listener, registered first, ran first.
 *
 *   Focus moves in on open and back on close, once. The sheet's effect used to
 *   depend on its onClose prop, which the app passes as a fresh arrow each
 *   render, so every re-render - including the nine-second availability tick -
 *   yanked keyboard focus back to the sheet's heading.
 */
import { useEffect, useRef } from 'react';

const stack = [];
let bound = false;

function onKey(e) {
  if (e.key !== 'Escape' || !stack.length) return;
  e.preventDefault();
  stack[stack.length - 1].current();
}

export function useLayer(active, { onEscape, focusRef } = {}) {
  const handler = useRef(onEscape);
  useEffect(() => { handler.current = onEscape; });

  useEffect(() => {
    if (!active || typeof document === 'undefined') return undefined;
    if (!bound) { document.addEventListener('keydown', onKey); bound = true; }
    const entry = { current: () => handler.current && handler.current() };
    stack.push(entry);

    const back = document.activeElement;
    const id = setTimeout(() => {
      try { if (focusRef && focusRef.current) focusRef.current.focus({ preventScroll: true }); } catch { /* */ }
    }, 60);

    return () => {
      clearTimeout(id);
      const i = stack.lastIndexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      if (back && back.isConnected) {
        setTimeout(() => { try { back.focus({ preventScroll: true }); } catch { /* */ } }, 30);
      }
    };
    // focusRef is a ref object and never changes identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
