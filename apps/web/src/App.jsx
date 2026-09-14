/**
 * Lonera, on the web.
 *
 * The state that used to be module-level globals in one 2,000-line script now
 * lives in hooks, and every rule it depends on comes from @lonera/core - the
 * same module the server imports. Nothing in this app decides who wins a
 * cancelled slot or whether a time may be called live.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { businesses, intent, ranking, slots as S } from '@lonera/core';

import { LangProvider, useLang } from './lib/useLang.jsx';
import { useInterests } from './lib/useInterests.js';
import { useAvailability } from './lib/useAvailability.js';
import { useStandby } from './lib/useStandby.js';
import { usePlan, buildPlan, tallyPlan } from './lib/usePlan.js';
import { durations, ease, useReducedMotion } from './lib/motion.js';

import Deck from './components/Deck.jsx';
import Screen from './components/Screen.jsx';
import Poster from './components/Poster.jsx';
import Rail from './components/Rail.jsx';
import Sheet from './components/Sheet.jsx';
import BusinessSheet from './components/BusinessSheet.jsx';
import PlanScreen from './components/PlanScreen.jsx';
import Photo from './components/Photo.jsx';

const PREVIEW_KEY = 'lonera.previewAck';

function Shell() {
  const { lang, t } = useLang();
  const reduced = useReducedMotion();
  const availability = useAvailability();
  const standby = useStandby();
  const { interests, note, clear, explain } = useInterests();
  const { plan, open: openPlan, close: closePlan, setPlan } = usePlan();

  const [tab, setTab] = useState('home');
  const [query, setQuery] = useState('');
  const [sheetBiz, setSheetBiz] = useState(null);
  const [toast, setToast] = useState(null);
  const [island, setIsland] = useState(null);
  const [notes, setNotes] = useState([]);
  const [why, setWhy] = useState(false);
  const [ack, setAck] = useState(() => {
    try { return localStorage.getItem(PREVIEW_KEY) === '1'; } catch { return false; }
  });

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }, []);

  /* A slot the standby queue won arrives while you are looking at something
     else, so it uses the island and is also logged - a slot won and never
     mentioned again is worse than no queue at all. */
  const onClaim = useCallback((biz, label, day) => {
    const name = lang === 'ko' && biz.nk ? biz.nk : biz.n;
    const msg = t('wlClaimedMsg')
      .replace('{biz}', name)
      .replace('{time}', S.formatSlot(label, lang));
    setIsland({ title: t('wlClaimedTitle'), message: msg });
    setNotes((prev) => [{ id: `${biz.id}-${label}`, who: name, text: msg }, ...prev]);
    setTimeout(() => setIsland(null), 6500);
  }, [lang, t]);

  const openBiz = useCallback((biz) => {
    note(biz.c);                       // their own tap, counted on their device
    setSheetBiz(biz);
  }, [note]);

  const planOpts = useMemo(() => ({
    dayOf: availability.dayOf,
    tierOf: availability.tierOf,
  }), [availability.dayOf, availability.tierOf]);

  const runSearch = useCallback(() => {
    const parsed = intent.parseLocal(query);
    if (parsed.services.length > 1) {
      const built = openPlan(parsed, planOpts);
      if (!built) showToast(t('plNone'));
      return;
    }
    const list = parsed.service ? businesses.byCategory(parsed.service) : [];
    if (list.length) openBiz(ranking.order(list, { interests, language: parsed.language || 'English' })[0]);
    else showToast(t('vsNone'));
  }, [query, openPlan, planOpts, showToast, t, openBiz, interests]);

  const swap = useCallback((service) => {
    if (!plan) return;
    const row = plan.rows.find((r) => r.service === service);
    if (!row || row.alternatives.length < 2) return;
    const i = row.alternatives.findIndex((b) => b.id === row.biz.id);
    const next = row.alternatives[(i + 1) % row.alternatives.length];
    const held = {};
    plan.rows.forEach((r) => { if (r.biz) held[r.service] = r.biz.id; });
    held[service] = next.id;
    setPlan(buildPlan(
      { raw: plan.raw, services: plan.rows.map((r) => r.service), language: plan.language, when: null },
      { ...planOpts, held },
    ));
    showToast(t('plSwapped').replace('{n}', lang === 'ko' && next.nk ? next.nk : next.n));
  }, [plan, planOpts, setPlan, showToast, t, lang]);

  /* Sending logs each visit at its real status, so "requested" and "booked"
     stay distinguishable after the screen closes. A toast is gone in two
     seconds; an errand is something you check tomorrow. */
  const sendPlan = useCallback(() => {
    if (!plan) return;
    const day = S.formatDay(plan.day, lang, t);
    const added = plan.rows.filter((r) => r.biz).map((r) => {
      const booked = Boolean(r.slot) && availability.tierOf(r.biz) === 'connected';
      const when = r.slot ? `${day} · ${S.formatSlot(r.slot, lang)}` : '';
      const key = booked ? 'plLogBooked' : r.slot ? 'plLogRequested' : 'plLogAsked';
      return {
        id: `${r.biz.id}-${r.service}-${Date.now()}`,
        who: lang === 'ko' && r.biz.nk ? r.biz.nk : r.biz.n,
        text: t(key).replace('{when}', when).replace('{svc}', r.service),
      };
    });
    setNotes((prev) => [...added, ...prev]);
    const n = tallyPlan(plan, availability.tierOf);
    closePlan();
    showToast(n.connected && !n.declared && !n.unknown ? t('plSentBooked') : t('plSent'));
  }, [plan, lang, t, closePlan, showToast]);

  const feed = useMemo(
    () => ranking.order(businesses.BIZ, { interests, language: lang === 'ko' ? 'Korean' : 'English', tierOf: availability.tierOf }),
    [interests, lang, availability.tierOf],
  );
  const anySample = useMemo(
    () => Boolean(plan && plan.rows.some((r) => r.biz && availability.tierOf(r.biz) !== 'unknown' && !availability.isLive(r.biz.id))),
    [plan, availability],
  );

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const screenTrans = reduced ? { duration: 0 } : { duration: durations.swap, ease };

  return (
    <div className="stage">
      <div className="phone">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            style={{ display: 'contents' }}
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={screenTrans}
          >
            <Screen id="home" active={tab === 'home'}>
              {!ack && (
                <div className="prev-strip" role="note">
                  <p>{t('previewNote')}</p>
                  <button
                    type="button"
                    aria-label={t('done')}
                    onClick={() => {
                      setAck(true);
                      try { localStorage.setItem(PREVIEW_KEY, '1'); } catch { /* fine */ }
                    }}
                  >✕</button>
                </div>
              )}
              <div className="head">
                <h2>{t('rowTrusted')}</h2>
                <p>{t('browseSub')}</p>
              </div>
              <Rail
                title={t('rowTrusted')}
                action={(
                  <button type="button" className="whybtn" onClick={() => setWhy(true)}>
                    {t('whyOrder')}
                  </button>
                )}
              >
                {feed.map((b, i) => (
                  <Poster
                    key={b.id}
                    biz={b}
                    onOpen={openBiz}
                    priority={i < 3}
                    isLive={availability.isLive(b.id)}
                    tier={availability.tierOf(b)}
                  />
                ))}
              </Rail>
            </Screen>

            <Screen id="browse" active={tab === 'browse'}>
              <div className="head"><h2>{t('browseTitle')}</h2><p>{t('browseSub')}</p></div>
              <div className="stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {businesses.CATS.map((c) => (
                  <button type="button" className="card" key={c[0]} onClick={() => { setQuery(c[0]); setTab('home'); }}>
                    <div className={`pic ${c[2]}`} style={{ height: 96, overflow: 'hidden', position: 'relative' }}>
                      <Photo name={c[3]} />
                    </div>
                    <div className="b" style={{ padding: '11px 12px 13px' }}>
                      <p className="t" style={{ fontSize: '.92rem' }}>{lang === 'ko' ? c[1] : c[0]}</p>
                      <p className="s" style={{ fontSize: '.78rem' }}>
                        {businesses.byCategory(c[0]).length} {t('catAll')}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </Screen>

            <Screen id="inbox" active={tab === 'inbox'}>
              <div className="head"><h2>{t('tabInbox')}</h2></div>
              <div className="stack">
                {notes.length ? notes.map((n) => (
                  <div className="row" key={n.id}>
                    <div className="bd"><p className="t">{n.who}</p><p className="s">{n.text}</p></div>
                  </div>
                )) : <div className="empty"><p>{t('avNoneLeft')}</p></div>}
              </div>
            </Screen>

            {['community', 'saved', 'you'].map((k) => (
              <Screen id={k} active={tab === k} key={k}>
                <div className="head"><h2>{t(`tab${k[0].toUpperCase()}${k.slice(1)}`)}</h2></div>
                <div className="empty"><p>{t('catNone')}</p></div>
              </Screen>
            ))}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          {toast && (
            <motion.div
              className="toast on"
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={screenTrans}
            >
              <span>{toast}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <Deck
          tab={tab}
          onTab={setTab}
          query={query}
          onQuery={setQuery}
          onSubmit={runSearch}
          listening={false}
          onMic={() => showToast(t('tNoVoice'))}
          unread={notes.length}
          island={island}
          onIslandClose={() => { setIsland(null); setTab('inbox'); }}
        />

        <BusinessSheet
          biz={sheetBiz}
          onClose={() => { availability.unwatch(); setSheetBiz(null); }}
          availability={availability}
          standby={standby}
          onClaim={onClaim}
          onToast={showToast}
        />

        <Sheet
          open={why}
          onClose={() => setWhy(false)}
          title={t('whyTitle')}
          sub={t('whySub')}
          footer={(
            <>
              <button type="button" className="btn sec" onClick={() => { clear(); setWhy(false); showToast(t('whyCleared')); }}>
                {t('whyReset')}
              </button>
              <button type="button" className="btn pri" onClick={() => setWhy(false)}>{t('done')}</button>
            </>
          )}
        >
          {explain().length ? (
            <div className="trust">
              {explain().map((x) => (
                <span className="vb b" key={x.category}>{x.category} ×{x.count}</span>
              ))}
            </div>
          ) : <p className="note">{t('whyNone')}</p>}
          <p className="note" style={{ marginTop: 12 }}>{t('whyHousing')}</p>
          <p className="note" style={{ marginTop: 10 }}>{t('whyLocal')}</p>
        </Sheet>

        {plan && (
          <PlanScreen
            plan={plan}
            tally={tallyPlan(plan, availability.tierOf)}
            anySample={anySample}
            onClose={closePlan}
            onSwap={swap}
            onSend={sendPlan}
            onAdjust={() => showToast(t('plAdjustPh'))}
          />
        )}
      </div>
    </div>
  );
}

export default function App() {
  return <LangProvider><Shell /></LangProvider>;
}
