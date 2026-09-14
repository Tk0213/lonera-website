/**
 * A week of days, with how many times each one has.
 *
 * The count is on the button on purpose. A date picker that makes you tap
 * through to discover a day is empty is the kind of thing that reads as
 * "this app is hard" to someone who is already translating in their head.
 * Days with nothing are disabled rather than hidden, so the week keeps its
 * shape and Thursday is always where Thursday was.
 */
import { motion } from 'motion/react';
import { slots as S } from '@lonera/core';
import { useLang } from '../lib/useLang.jsx';
import { durations, useTransition } from '../lib/motion.js';

export default function DayStrip({ value, onChange, countFor }) {
  const { lang, t } = useLang();
  const transition = useTransition({ duration: durations.press });
  return (
    <div className="avdays" role="tablist" aria-label={t('book')}>
      {Array.from({ length: S.HORIZON_DAYS }, (_, o) => {
        const n = countFor(o);
        const on = o === value;
        return (
          <motion.button
            key={o}
            role="tab"
            aria-selected={on}
            disabled={!n}
            className={`avday${on ? ' on' : ''}`}
            onClick={() => onChange(o)}
            whileTap={n ? { scale: 0.96 } : undefined}
            transition={transition}
          >
            <i>{S.formatDay(o, lang, t)}</i>
            <b>{n ? t('avNOpen').replace('{n}', n) : t('avNoneShort')}</b>
          </motion.button>
        );
      })}
    </div>
  );
}
