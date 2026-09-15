/**
 * One errand, several visits.
 *
 * Every row carries its own tier badge, because the tiers genuinely differ
 * inside one errand and a single summary badge would average "booked" and
 * "requested" into the same word. The button names the mixture it is about
 * to send for the same reason.
 *
 * Swap opens a ranked list rather than replacing a business on the spot. The
 * business card is plain content, not a button: it used to be a <button> with
 * no action, a keyboard stop that did nothing.
 */
import { useRef } from 'react';
import { motion } from 'motion/react';
import { businesses, slots as S } from '@lonera/core';
import Photo from './Photo.jsx';
import { useLang } from '../lib/useLang.jsx';
import { durations, ease, listItem, useReducedMotion } from '../lib/motion.js';
import { useLayer } from '../lib/useLayer.js';

const TIER_KEY = { connected: 'avLive', declared: 'avUsual', unknown: 'avAsk' };
/* The language someone asked to be served in, named in the language they are
   reading. "Korean" inside a Korean interface was a half-translated seam. */
const LANG_KO = { Korean: '한국어', Tagalog: '타갈로그어', Mandarin: '중국어', Punjabi: '펀자브어', English: '영어' };

export default function PlanScreen({ plan, tally, tierOf, onClose, onSwap, onSend, onAdjust, anySample }) {
  const { lang, t } = useLang();
  const reduced = useReducedMotion();
  const headRef = useRef(null);
  useLayer(Boolean(plan), { onEscape: onClose, focusRef: headRef });
  if (!plan) return null;

  const day = S.formatDay(plan.day, lang, t);
  const svcLabel = (svc) => (lang === 'ko' ? ((businesses.CATS.find((c) => c[0] === svc) || [])[1] || svc) : svc);
  const langLabel = plan.language
    ? (lang === 'ko' ? LANG_KO[plan.language] || plan.language : plan.language)
    : t('plAnyLang');
  const tag = (cls, key, n) => (n ? <span className={`pltag ${cls}`}>{n} {t(key)}</span> : null);

  return (
    <motion.div
      className="pl on"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plTitle"
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: 14, transition: { duration: durations.screen * 0.65 } }}
      transition={reduced ? { duration: 0 } : { duration: durations.screen, ease }}
    >
      <div className="pl-top">
        <button type="button" className="vs-x" onClick={onClose} aria-label={t('done')}>✕</button>
      </div>
      <div className="pl-head">
        <h2 id="plTitle" tabIndex={-1} ref={headRef}>{t('plTitle')}</h2>
        <p className="pl-sub">
          {t('plSub').replace('{n}', plan.rows.length).replace('{when}', day).replace('{lang}', langLabel)}
        </p>
        <div className="pl-tally">
          {tag('ok', 'plLive', tally.connected)}
          {tag('b', 'plReqN', tally.declared)}
          {tag('off', 'plAskN', tally.unknown)}
        </div>
        {anySample && <p className="avsample">{t('avSample')}</p>}
      </div>

      <div className="pl-rows">
        {plan.rows.map((r, i) => {
          const tier = r.biz ? (tierOf ? tierOf(r.biz) : r.biz.av || 'unknown') : 'unknown';
          const name = r.biz && (lang === 'ko' && r.biz.nk ? r.biz.nk : r.biz.n);
          return (
            <motion.div
              className="plrow"
              key={r.service}
              custom={i}
              variants={reduced ? undefined : listItem}
              initial={reduced ? false : 'hidden'}
              animate="shown"
              layout={!reduced}
            >
              <div className="plr-top">
                <span className="plr-svc">{svcLabel(r.service)}</span>
                {r.biz && <span className={`pav ${tier}`}>{t(TIER_KEY[tier] || 'avAsk')}</span>}
              </div>
              {!r.biz ? (
                <p className="plr-none">{t('plNoMatch').replace('{svc}', svcLabel(r.service))}</p>
              ) : (
                <>
                  <div className="plr-biz">
                    <span className={`plr-art ${r.biz.g}`}><Photo name={r.biz.sc} /></span>
                    <span className="plr-bd">
                      <span className="plr-n">{name}</span>
                      <span className="plr-m">★ {r.biz.r} · {r.biz.a} · {r.biz.p}</span>
                    </span>
                  </div>
                  <div className="plr-foot">
                    {r.slot
                      ? <span className="plr-t">{day} · {S.formatSlot(r.slot, lang)}</span>
                      : <span className="plr-t off">{t('plWillAsk')}</span>}
                    {r.alternatives.length > 1 && (
                      <button type="button" className="plr-swap" aria-haspopup="dialog" onClick={() => onSwap(r.service)}>
                        {t('plSwap')}
                      </button>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="pl-go">
        <button type="button" className="btn pri" onClick={onSend}>
          {tally.connected && (tally.declared || tally.unknown) ? t('plGoMixed')
            : tally.connected ? t('plGoBook')
              : tally.declared ? t('plGoRequest')
                : t('plGoAsk')}
        </button>
        <button type="button" className="btn sec pl-mic" onClick={onAdjust}>{t('plAdjust')}</button>
      </div>
    </motion.div>
  );
}
