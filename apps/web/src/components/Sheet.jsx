/**
 * The bottom sheet every action opens in.
 *
 * Bottom, always, because the whole layout assumes one-thumb reach. Two things
 * the prototype had to be taught and this gets for free from AnimatePresence:
 * the sheet animates *out* before unmounting, and while closed it is not in
 * the DOM at all - so nothing inside a hidden sheet can be tabbed into, which
 * was a real bug found by testing rather than reading.
 *
 * Escape closes, focus moves to the heading on open and returns to whatever
 * opened it on close. Without that a keyboard or screen-reader user opens a
 * sheet and is still standing in the page behind it.
 */
import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { durations, ease, useReducedMotion } from '../lib/motion.js';

export default function Sheet({ open, onClose, title, sub, children, footer }) {
  const reduced = useReducedMotion();
  const headRef = useRef(null);
  const returnTo = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    returnTo.current = document.activeElement;
    const id = setTimeout(() => { try { headRef.current?.focus({ preventScroll: true }); } catch { /* */ } }, 60);
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(id);
      document.removeEventListener('keydown', onKey);
      const back = returnTo.current;
      if (back && back.isConnected) setTimeout(() => { try { back.focus({ preventScroll: true }); } catch { /* */ } }, 30);
    };
  }, [open, onClose]);

  const t = reduced ? { duration: 0 } : { duration: durations.sheet, ease };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="scrim on"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: durations.sheet * 0.65 } }}
            transition={t}
          />
          <motion.div
            className="sheet on"
            role="dialog"
            aria-modal="true"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%', transition: { duration: durations.sheet * 0.65, ease } }}
            transition={t}
          >
            <div className="grip" />
            <div className="sheet-body">
              <h3 tabIndex={-1} ref={headRef}>{title}</h3>
              {sub && <p className="sub">{sub}</p>}
              {children}
            </div>
            {footer && <div className="sheet-foot">{footer}</div>}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
