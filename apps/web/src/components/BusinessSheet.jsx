/**
 * One business: what they do, what it costs, and when they can actually come.
 *
 * The availability block states its tier and then behaves like it:
 *   - every business is asked about on open, not only ones the sample data
 *     calls live, so the server's answer can correct the badge either way;
 *   - live taking and cancelling runs only for a connected calendar - nothing
 *     can know a slot was "just taken" at a business that only published its
 *     usual hours;
 *   - the stand-in notice shows only until the server has answered, because
 *     after that the times are the server's, not examples.
 */
import { useEffect, useRef, useState } from 'react';
import { slots as S } from '@lonera/core';
import Photo from './Photo.jsx';
import DayStrip from './DayStrip.jsx';
import SlotGrid from './SlotGrid.jsx';
import Sheet from './Sheet.jsx';
import { useLang } from '../lib/useLang.jsx';

const META = {
  connected: { k: 'avLive', why: 'avLiveWhy', cls: 'ok' },
  declared: { k: 'avUsual', why: 'avUsualWhy', cls: 'b' },
  unknown: { k: 'avAsk', why: 'avAskWhy', cls: 'off' },
};
const CTA = { connected: 'avPickTime', declared: 'avRequest', unknown: 'avAskThem' };

export default function BusinessSheet({ biz, onClose, availability, standby, onClaim, onToast }) {
  const { lang, t } = useLang();
  const [day, setDay] = useState(0);
  const bizId = biz ? biz.id : null;
  const tier = availability.tierOf(biz);
  const meta = META[tier] || META.unknown;
  const answered = bizId ? availability.answered(bizId) : false;
  const claim = useRef(onClaim);
  useEffect(() => { claim.current = onClaim; });

  useEffect(() => { setDay(0); }, [bizId]);

  useEffect(() => {
    if (biz) availability.refresh(biz);
    // refresh is stable; re-asking belongs to a different business, not a re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bizId]);

  useEffect(() => {
    if (!biz || tier !== 'connected') return undefined;
    availability.ensure(biz.id, day, tier);
    availability.watch(biz.id, day, {
      onCancel: (label) => {
        const mine = standby.release(biz.id, day, label);
        if (mine) claim.current(biz, label, day);
        return mine;
      },
    });
    return availability.unwatch;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bizId, day, tier]);

  if (!biz) return <Sheet open={false} onClose={onClose} title="" />;

  const name = lang === 'ko' && biz.nk ? biz.nk : biz.n;
  const d = availability.dayOf(biz.id, day, tier);
  const countFor = (o) => (tier !== 'unknown' ? availability.dayOf(biz.id, o, tier).open.length : 0);
  const why = tier === 'connected' && !answered ? t('avSampleWhy') : t(meta.why);

  return (
    <Sheet
      open
      onClose={onClose}
      title={name}
      sub={`★ ${biz.r} (${biz.rv}) · ${lang === 'ko' && biz.ck ? biz.ck : biz.c} · ${biz.a}`}
      footer={(
        <>
          <button type="button" className="btn pri" onClick={() => onToast(t('tSent'))}>{t('choose')}</button>
          <button type="button" className="btn sec" onClick={() => onToast(t('tSent'))}>{t(CTA[tier] || CTA.unknown)}</button>
        </>
      )}
    >
      <div className={`pic ${biz.g}`} style={{ height: 150, borderRadius: 14, overflow: 'hidden', position: 'relative', marginBottom: 12 }}>
        <Photo name={biz.sc} priority alt={name} />
      </div>
      <p style={{ margin: 0, fontSize: '.95rem', lineHeight: 1.55 }}>{lang === 'ko' && biz.dk ? biz.dk : biz.d}</p>

      <p className="lb" style={{ marginTop: 20 }}>{t('book')}</p>
      <div className="trust" style={{ margin: '0 0 8px' }}>
        <span className={`vb ${meta.cls}`}>{t(meta.k)}</span>
      </div>
      <p className="avwhy">{why}</p>
      {tier !== 'unknown' && !answered && <p className="avsample">{t('avSample')}</p>}

      {tier !== 'unknown' && (
        <>
          <DayStrip value={day} onChange={setDay} countFor={countFor} />
          <SlotGrid
            day={day}
            open={d.open}
            taken={d.taken}
            won={d.won}
            standby={(label) => standby.info(biz.id, day, label)}
            onPick={(label) => onToast(`${S.formatDay(day, lang, t)} · ${S.formatSlot(label, lang)}`)}
            onJoin={(label) => {
              const r = standby.join(biz.id, day, label);
              onToast(r.ok ? t('wlJoined').replace('{n}', r.position) : t('wlMax').replace('{n}', standby.max));
            }}
            onLeave={(label) => { standby.leave(biz.id, day, label); onToast(t('wlLeft')); }}
          />
        </>
      )}
    </Sheet>
  );
}
