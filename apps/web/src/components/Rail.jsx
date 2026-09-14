/**
 * A horizontal rail.
 *
 * Smoothness here is mostly restraint. `overscroll-behavior-x: contain` keeps
 * a sideways swipe inside the rail instead of chaining to the page, and
 * `touch-action: pan-x pan-y` lets the browser commit to one axis on the first
 * move rather than after a frame of ambiguity - which is what made the
 * prototype's rails feel like they were deciding whether to obey you.
 *
 * Items are not animated in on scroll. A rail that re-animates every time it
 * comes back into view reads as a page that never settles, and on a phone that
 * is most of the time.
 */
import { memo } from 'react';

function Rail({ title, action, children }) {
  return (
    <>
      {title && (
        <div className="rowtitle">
          <h3>{title}</h3>
          {action}
        </div>
      )}
      <div className="rail">{children}</div>
    </>
  );
}

export default memo(Rail);
