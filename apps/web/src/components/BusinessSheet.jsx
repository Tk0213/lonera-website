/**
 * One business: what they do, what it costs, and when they can actually come.
 *
 * The availability block states its tier and then behaves like it. Only a
 * business whose calendar answered gets "straight from their calendar" and a
 * "pick a time" button; everything else routes to request-and-confirm and says
 * why. The preview notice is not boilerplate - without a connected feed these
 * times are invented, and the sheet used to claim otherwise.
 */
import { useEffect, useMemo, useState } from 'react';
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
  /* The server outranks the sample record. A business marked connected in
     the demo data but with no feed configured resolves to declared, and the
     sheet has to say declared - a live badge over requested times is the
     contradiction the tier model exists to remove. */
  const tier = availability.tierOf(biz);
  const live = biz ? availability.isLive(biz.id) : false;
  const meta = META[tier];

  useEffect(() => { setDay(0); }, [biz && biz.id]);

  // Try the real endpoint; the labelled stand-in covers it when unreachable.
  useEffect(() => {
    if (!biz || tier !== 'connected') return;
    availability.refresh(biz);
  }, [biz && biz.id, tier]);

  // Watch for slots going, and hand a cancellation to the head of the line.
  useEffect(() => {
    if (!biz || tier === 'unknown') return undefined;
    availability.ensure(biz.id, day, tier);
    availability.watch(biz.id, day, {
      onCancel: (label) => {
        const mine = standby.release(biz.id, day, label);
        if (mine) onClaim(biz, label, day);
        return mine;
      },
    });
    return availability.unwatch;
  }, [biz && biz.id, day, tier]);

  const d = biz ? availability.dayOf(biz.id, day, tier) : { open: [], taken: [], won: [] };
  const countFor = useMemo(
    () => (o) => (biz && tier !== 'unknown' ? availability.dayOf(biz.id, o, tier).open.length : 0),
    [biz && biz.id, tier, availability],
  );

  if (!biz) return <Sheet open={false} onClose={onClose} title="" />;
  const name = lang === 'ko' && biz.nk ? biz.nk : biz.n;

  return (
    <Sheet
      open={Boolean(biz)}
      onClose={onClose}
      title={name}
      sub={`★ ${biz.r} (${biz.rv}) · ${lang === 'ko' && biz.ck ? biz.ck : biz.c} · ${biz.a}`}
      footer={(
        <>
          <button type="button" className="btn pri" onClick={() => onToast(t('tSent'))}>
            {t('choose')}
          </button>
          <button type="button" className="btn sec" onClick={() => onToast(t('tSent'))}>
            {t(CTA[tier])}
          </button>
        </>
      )}
    >
      <div className={`pic ${biz.g}`} style={{ height: 150, borderRadius: 14, overflow: 'hidden', position: 'relative', marginBottom: 12 }}>
        <Photo name={biz.sc} priority alt={name} />
      </div>
      <p style={{ margin: 0, fontSize: '.95rem', lineHeight: 1.55 }}>
        {lang === 'ko' && biz.dk ? biz.dk : biz.d}
      </p>

      <p className="lb" style={{ marginTop: 20 }}>{t('book')}</p>
      <div className="trust" style={{ margin: '0 0 8px' }}>
        <span className={`vb ${meta.cls}`}>{t(meta.k)}</span>
      </div>
      <p className="avwhy">{tier === 'connected' && !live ? t('avSampleWhy') : t(meta.why)}</p>
      {tier !== 'unknown' && !live && <p className="avsample">{t('avSample')}</p>}

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
              onToast(r.ok
                ? t('wlJoined').replace('{n}', r.position)
                : t('wlMax').replace('{n}', standby.max));
            }}
            onLeave={(label) => { standby.leave(biz.id, day, label); onToast(t('wlLeft')); }}
          />
        </>
      )}
    </Sheet>
  );
}
