/**
 * The bottom sheet every action opens in.
 *
 * Bottom, always, because the whole layout assumes one-thumb reach. While
 * closed it is not in the DOM at all, so nothing inside a hidden sheet can be
 * tabbed into. Escape and focus are handled by useLayer, which knows which
 * layer is on top - `raised` puts a sheet above the full-screen plan.
 */
import { Fragment, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { durations, ease, useReducedMotion } from '../lib/motion.js';
import { useLayer } from '../lib/useLayer.js';

export default function Sheet({ open, onClose, title, sub, children, footer, raised = false }) {
  const reduced = useReducedMotion();
  const headRef = useRef(null);
  useLayer(open, { onEscape: onClose, focusRef: headRef });

  const enter = reduced ? { duration: 0 } : { duration: durations.sheet, ease };
  const exit = reduced ? { duration: 0 } : { duration: durations.sheet * 0.65, ease };
  const layer = raised ? ' top' : '';

  return (
    <AnimatePresence>
      {open && (
        <Fragment key="layer">
          <motion.div
            className={`scrim on${layer}`}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: exit }}
            transition={enter}
          />
          <motion.div
            className={`sheet on${layer}`}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%', transition: exit }}
            transition={enter}
          >
            <div className="grip" />
            <div className="sheet-body">
              <h3 tabIndex={-1} ref={headRef}>{title}</h3>
              {sub && <p className="sub">{sub}</p>}
              {children}
            </div>
            {footer && <div className="sheet-foot">{footer}</div>}
          </motion.div>
        </Fragment>
      )}
    </AnimatePresence>
  );
}
