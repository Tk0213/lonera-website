/**
 * Times for one day, and the standby line behind each taken one.
 *
 * This is where anime.js earns its place rather than Motion. Motion is for
 * component lifecycle - a sheet arriving, a screen leaving, layout settling.
 * What happens here is an imperative timeline on nodes React is not
 * remounting: a slot is struck through, its label crossfades to "just taken",
 * and the standby control slides under it, in sequence. Expressing that as
 * component variants means inventing state for each step; as a timeline it is
 * four lines and reads in the order it happens.
 *
 * The reduced-motion rule from lib/motion.js applies without exception. A slot
 * that went is struck through, greyed and relabelled - the animation only
 * draws attention to a change that is already legible standing still.
 */
import { useEffect, useRef } from 'react';
import anime from 'animejs';
import { slots as S } from '@lonera/core';
import { useLang } from '../lib/useLang.jsx';
import { useReducedMotion } from '../lib/motion.js';

export default function SlotGrid({ day, open, taken, won, standby, onPick, onJoin, onLeave }) {
  const { lang, t } = useLang();
  const reduced = useReducedMotion();
  const gridRef = useRef(null);
  const seen = useRef(new Set());

  // Stagger only slots that are new to the grid, so switching day animates
  // and a repaint of the same day does not.
  useEffect(() => {
    if (reduced || !gridRef.current) return;
    const fresh = [...gridRef.current.querySelectorAll('[data-slot]')]
      .filter((el) => !seen.current.has(`${day}|${el.dataset.slot}`));
    fresh.forEach((el) => seen.current.add(`${day}|${el.dataset.slot}`));
    if (!fresh.length) return;
    anime({
      targets: fresh,
      opacity: [0, 1],
      translateY: [8, 0],
      delay: anime.stagger(28),
      duration: 260,
      easing: 'easeOutCubic',
    });
  }, [day, open.length, reduced]);

  const ordinal = (n) => {
    if (lang === 'ko') return `${n}${t('wlOrdSuffix')}`;
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  return (
    <div className="avgrid" ref={gridRef}>
      {won.map((label) => (
        <span className="slot won" key={`won-${label}`}>
          {S.formatSlot(label, lang)}<i>{t('wlGotIt')}</i>
        </span>
      ))}

      {open.map((label) => (
        <button
          type="button"
          className="slot"
          data-slot={label}
          key={label}
          onClick={() => onPick && onPick(label)}
        >
          {S.formatSlot(label, lang)}
        </button>
      ))}

      {taken.map((label) => {
        const { position, length } = standby(label);
        return (
          <span className="wlwrap" key={`t-${label}`}>
            <span className="slot gone">
              {S.formatSlot(label, lang)}<i>{t('avTaken')}</i>
            </span>
            {position ? (
              <button type="button" className="wlbtn in" onClick={() => onLeave(label)}>
                {t('wlYoureNth').replace('{n}', ordinal(position))} · {t('wlLeave')}
              </button>
            ) : (
              <button type="button" className="wlbtn" onClick={() => onJoin(label)}>
                {t('wlJoin')}{length ? ` · ${t('wlAhead').replace('{n}', length)}` : ''}
              </button>
            )}
          </span>
        );
      })}

      {!open.length && !taken.length && !won.length && (
        <p className="ds-empty">{t('avNoneLeft')}</p>
      )}
    </div>
  );
}
