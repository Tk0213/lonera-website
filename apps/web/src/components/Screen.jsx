/**
 * One tab's content, with its scroll position kept.
 *
 * The offset is recorded as the user scrolls. The first version read
 * scrollTop in an effect cleanup - which runs after React has already removed
 * the node, when scrollTop is always 0 - so every tab reopened at the top of a
 * list the user had scrolled halfway down, while the comment claimed it kept
 * their place.
 *
 * The fade lives here, on the scroller itself. It used to sit on a wrapper
 * with display: contents, which has no box, so the opacity never rendered.
 */
import { useLayoutEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { durations, ease, useReducedMotion } from '../lib/motion.js';

const offsets = new Map();

export default function Screen({ id, active, children }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    if (active && ref.current) ref.current.scrollTop = offsets.get(id) || 0;
  }, [id, active]);

  if (!active) return null;
  return (
    <motion.div
      ref={ref}
      className="screen"
      id={`v-${String(id).split(':')[0]}`}
      onScroll={(e) => offsets.set(id, e.currentTarget.scrollTop)}
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduced ? { duration: 0 } : { duration: durations.swap, ease }}
    >
      <div className="view">{children}</div>
    </motion.div>
  );
}
