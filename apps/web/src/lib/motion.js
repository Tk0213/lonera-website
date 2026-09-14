/**
 * Shared motion vocabulary.
 *
 * One set of curves and durations for the whole app, because the fastest way
 * to make an interface feel cheap is to animate each thing slightly
 * differently. These are the values the prototype arrived at by hand, now
 * named once.
 *
 * The reduced-motion rule here is not decoration. Earlier in this project the
 * listening state of the microphone button was carried by a pulse animation
 * alone, so with `prefers-reduced-motion` set, listening and idle rendered
 * pixel-identical - the only cue for "we are recording you" was the thing the
 * user had asked the system to switch off. So: motion may carry emphasis, and
 * never state. Every animated state must also change colour, shape, icon or
 * label.
 */
import { useEffect, useState } from 'react';

/** Enter/arrive: decelerating, so things settle rather than stop. */
export const ease = [0.2, 0.9, 0.3, 1];
/** Springs for anything the thumb drives directly. */
export const spring = { type: 'spring', stiffness: 420, damping: 34, mass: 0.9 };
export const springSoft = { type: 'spring', stiffness: 260, damping: 30 };

export const durations = { press: 0.14, swap: 0.22, sheet: 0.3, screen: 0.32 };

/** Exit is quicker than enter - a dismissal should feel obeyed, not narrated. */
export const exitFactor = 0.65;

export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (typeof matchMedia !== 'function') return undefined;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = (e) => setReduced(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** Transition props that collapse to an instant cut when motion is reduced. */
export function useTransition(base = spring) {
  const reduced = useReducedMotion();
  return reduced ? { duration: 0 } : base;
}

/** Sheet and overlay variants, shared so every layer arrives the same way. */
export const sheetVariants = {
  hidden: { y: '100%' },
  shown: { y: 0 },
};
export const screenVariants = {
  hidden: { opacity: 0, y: 14 },
  shown: { opacity: 1, y: 0 },
};
export const listItem = {
  hidden: { opacity: 0, y: 10 },
  shown: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: Math.min(i, 8) * 0.035 } }),
};
