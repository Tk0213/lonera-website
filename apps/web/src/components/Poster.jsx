/**
 * The poster card: artwork dominates, text sits over a measured scrim.
 *
 * The availability badge is on the card rather than only inside the sheet,
 * because the tier changes what tapping it will get you and that should not be
 * a surprise. "Free today" appears only for a business whose calendar actually
 * answered - it used to sit beside "Ask for times" on the same card, which is
 * the exact contradiction the tiers exist to remove.
 */
import { memo } from 'react';
import { motion } from 'motion/react';
import Photo from './Photo.jsx';
import { useLang } from '../lib/useLang.jsx';
import { durations, useTransition } from '../lib/motion.js';

const TIER_KEY = { connected: 'avLive', declared: 'avUsual', unknown: 'avAsk' };

function Poster({ biz, onOpen, priority = false, isLive = false, tier: tierProp }) {
  const { lang, t } = useLang();
  const transition = useTransition({ duration: durations.press });
  const name = lang === 'ko' && biz.nk ? biz.nk : biz.n;
  /* Prefer the resolved tier. The record's own `av` is a stand-in until the
     server answers for this business, and a card that claims "live times"
     while the sheet says "usual hours" is the contradiction in miniature. */
  const tier = tierProp || biz.av || 'unknown';
  const claimsFree = Boolean(biz.free) && tier === 'connected' && isLive;

  return (
    <motion.button
      className="poster"
      onClick={() => onOpen(biz)}
      whileTap={{ scale: 0.96 }}
      whileHover={{ scale: 1.045 }}
      transition={transition}
      aria-label={`${name}. ${t(TIER_KEY[tier])}`}
    >
      <span className={`pw ${biz.g}`}>
        <Photo name={biz.sc} priority={priority} />
        {claimsFree && <span className="flag">{t('openNow')}</span>}
        <span className="pt">
          <span className="pp">{biz.p}</span>
          <span className="pn">{name}</span>
        </span>
      </span>
      <span className="pmeta">★ {biz.r} · {lang === 'ko' && biz.ck ? biz.ck : biz.c}</span>
      <span className={`pav ${tier}`}>{t(TIER_KEY[tier])}</span>
    </motion.button>
  );
}

export default memo(Poster);
