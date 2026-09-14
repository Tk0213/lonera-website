/**
 * One errand, several visits.
 *
 * Every row carries its own tier badge rather than the plan carrying one
 * summary badge, because the tiers genuinely differ inside a single errand and
 * averaging them away is how "booked" and "requested" become the same word.
 * The button names the mixture it is about to send for the same reason.
 */
import { AnimatePresence, motion } from 'motion/react';
import { slots as S } from '@lonera/core';
import Photo from './Photo.jsx';
import { useLang } from '../lib/useLang.jsx';
import { durations, ease, listItem, useReducedMotion } from '../lib/motion.js';

const TIER_KEY = { connected: 'avLive', declared: 'avUsual', unknown: 'avAsk' };

export default function PlanScreen({ plan, tally, onClose, onSwap, onSend, onAdjust, anySample }) {
  const { lang, t } = useLang();
  const reduced = useReducedMotion();
  if (!plan) return null;

  const day = S.formatDay(plan.day, lang, t);
  const tag = (cls, key, n) => (n ? <span className={`pltag ${cls}`}>{n} {t(key)}</span> : null);
  const trans = reduced ? { duration: 0 } : { duration: durations.screen, ease };

  return (
    <AnimatePresence>
      <motion.div
        className="pl on"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plTitle"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 14, transition: { duration: durations.screen * 0.65 } }}
        transition={trans}
      >
        <div className="pl-top">
          <button type="button" className="vs-x" onClick={onClose} aria-label={t('done')}>✕</button>
        </div>
        <div className="pl-head">
          <h2 id="plTitle">{t('plTitle')}</h2>
          <p className="pl-sub">
            {t('plSub')
              .replace('{n}', plan.rows.length)
              .replace('{when}', day)
              .replace('{lang}', plan.language || t('plAnyLang'))}
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
            const tier = r.biz ? (r.biz.av || 'unknown') : 'unknown';
            const name = r.biz && lang === 'ko' && r.biz.nk ? r.biz.nk : r.biz && r.biz.n;
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
                  <span className="plr-svc">{r.service}</span>
                  {r.biz && <span className={`pav ${tier}`}>{t(TIER_KEY[tier])}</span>}
                </div>
                {!r.biz ? (
                  <p className="plr-none">{t('plNoMatch').replace('{svc}', r.service)}</p>
                ) : (
                  <>
                    <button type="button" className="plr-biz">
                      <span className={`plr-art ${r.biz.g}`}><Photo name={r.biz.sc} /></span>
                      <span className="plr-bd">
                        <span className="plr-n">{name}</span>
                        <span className="plr-m">★ {r.biz.r} · {r.biz.a} · {r.biz.p}</span>
                      </span>
                    </button>
                    <div className="plr-foot">
                      {r.slot
                        ? <span className="plr-t">{day} · {S.formatSlot(r.slot, lang)}</span>
                        : <span className="plr-t off">{t('plWillAsk')}</span>}
                      {r.alternatives.length > 1 && (
                        <button type="button" className="plr-swap" onClick={() => onSwap(r.service)}>
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
          <button type="button" className="btn sec pl-mic" onClick={onAdjust}>
            {t('plAdjust')}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
