/**
 * One tab's content, with its scroll position kept.
 *
 * This is the part of "smoother" that has nothing to do with animation. The
 * prototype rebuilt all eight views on any change and shared one scroll
 * container, so switching tabs and coming back put you at the top of a list
 * you had scrolled halfway down. Each screen keeps its own scroller and its
 * own offset, which is what makes moving between tabs feel like returning
 * rather than reloading.
 */
import { useEffect, useRef } from 'react';

const offsets = new Map();

export default function Screen({ id, active, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (active) {
      el.scrollTop = offsets.get(id) || 0;
    }
    return () => { if (el) offsets.set(id, el.scrollTop); };
  }, [id, active]);

  if (!active) return null;
  return (
    <div className="screen" ref={ref} id={`v-${id}`}>
      <div className="view">{children}</div>
    </div>
  );
}
