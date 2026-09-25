/**
 * Lonera, on the web.
 *
 * State lives in hooks, and every rule it depends on comes from @lonera/core -
 * the same module the server imports. Nothing in this app decides who wins a
 * cancelled slot, whether a time may be called live, or how a request ranks.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { businesses, intent, ranking, slots as S } from '@lonera/core';

import { LangProvider, useLang } from './lib/useLang.jsx';
import { useInterests } from './lib/useInterests.js';
import { useAvailability } from './lib/useAvailability.js';
import { useStandby } from './lib/useStandby.js';
import { usePlan, buildPlan, tallyPlan } from './lib/usePlan.js';
import { useSpeech } from './lib/useSpeech.js';
import { durations, ease, useReducedMotion } from './lib/motion.js';

import Deck from './components/Deck.jsx';
import Screen from './components/Screen.jsx';
import Poster from './components/Poster.jsx';
import Rail from './components/Rail.jsx';
import Sheet from './components/Sheet.jsx';
import BusinessSheet from './components/BusinessSheet.jsx';
import PlanScreen from './components/PlanScreen.jsx';
import SearchScreen from './components/SearchScreen.jsx';
import Photo from './components/Photo.jsx';

const PREVIEW_KEY = 'lonera.previewAck';
const TIER_KEY = { connected: 'avLive', declared: 'avUsual', unknown: 'avAsk' };

/**
 * A value that clears itself after `ms`, with one timer per value. Each toast
 * used to start its own timeout without cancelling the previous one, so a
 * toast shown two seconds after another vanished almost at once when the
 * earlier timer fired.
 */
function useTimedValue(ms) {
  const [value, setValue] = useState(null);
  const timer = useRef(null);
  const show = useCallback((next) => {
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setValue(null), ms);
  }, [ms]);
  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setValue(null);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [value, show, hide];
}

function Shell() {
  const { lang, t } = useLang();
  const reduced = useReducedMotion();
  const availability = useAvailability();
  const standby = useStandby();
  const { interests, note, clear, explain } = useInterests();
  const { plan, open: openPlan, close: closePlan, setPlan } = usePlan();

  const [tab, setTab] = useState('home');
  const [category, setCategory] = useState(null);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sheetBiz, setSheetBiz] = useState(null);
  const [swapService, setSwapService] = useState(null);
  const [notes, setNotes] = useState([]);
  const [seen, setSeen] = useState(0);
  const [why, setWhy] = useState(false);
  const [toast, showToast] = useTimedValue(2400);
  const [island, showIsland, hideIsland] = useTimedValue(6500);
  const [ack, setAck] = useState(() => {
    try { return localStorage.getItem(PREVIEW_KEY) === '1'; } catch { return false; }
  });

  const serveLanguage = lang === 'ko' ? 'Korean' : 'English';
  const bizName = useCallback((b) => (lang === 'ko' && b.nk ? b.nk : b.n), [lang]);
  const catLabel = useCallback(
    (c) => (lang === 'ko' ? ((businesses.CATS.find((x) => x[0] === c) || [])[1] || c) : c),
    [lang],
  );

  /* A slot the standby queue won arrives while you are looking at something
     else, so it uses the island and is also logged. */
  const onClaim = useCallback((biz, label) => {
    const msg = t('wlClaimedMsg').replace('{biz}', bizName(biz)).replace('{time}', S.formatSlot(label, lang));
    showIsland({ title: t('wlClaimedTitle'), message: msg });
    setNotes((prev) => [{ id: `${biz.id}-${label}-${Date.now()}`, who: bizName(biz), text: msg }, ...prev]);
  }, [lang, t, bizName, showIsland]);

  const openBiz = useCallback((biz) => {
    note(biz.c);                     // their own tap, counted on their own device
    setSheetBiz(biz);
  }, [note]);

  const planOpts = useMemo(
    () => ({ dayOf: availability.dayOf, tierOf: availability.tierOf }),
    [availability.dayOf, availability.tierOf],
  );

  const runQuery = useCallback((text) => {
    const parsed = intent.parseLocal(text);
    if (parsed.services.length > 1) {
      if (!openPlan(parsed, planOpts)) showToast(t('plNone'));
      return;
    }
    const list = parsed.service ? businesses.byCategory(parsed.service) : [];
    if (!list.length) { showToast(t('vsNone')); return; }
    openBiz(ranking.order(list, {
      interests, language: parsed.language || serveLanguage, tierOf: availability.tierOf,
    })[0]);
  }, [openPlan, planOpts, showToast, t, openBiz, interests, serveLanguage, availability.tierOf]);

  /* Voice fills the field as it hears, and a final result runs the search and
     closes the search screen - so speaking and typing end in the same place. */
  const speech = useSpeech({
    lang,
    onResult: (text, isFinal) => {
      setQuery(text);
      if (isFinal && text.trim()) { setSearchOpen(false); runQuery(text); }
    },
    onUnavailable: () => showToast(t('tNoVoice')),
  });

  /* Swap opens a list ranked for the original request, and choosing from it
     rebuilds the plan with that business held in place. It used to replace the
     business immediately with the next candidate, which the brief rules out:
     a swap is a choice, not a shuffle. */
  const chooseSwap = useCallback((service, next) => {
    if (!plan) return;
    const held = {};
    plan.rows.forEach((r) => { if (r.biz) held[r.service] = r.biz.id; });
    held[service] = next.id;
    setPlan(buildPlan(
      { raw: plan.raw, services: plan.rows.map((r) => r.service), language: plan.language,
        when: plan.when, week: plan.week },
      { ...planOpts, held },
    ));
    setSwapService(null);
    showToast(t('plSwapped').replace('{n}', bizName(next)));
  }, [plan, planOpts, setPlan, showToast, t, bizName]);

  /* Sending logs each visit at its real status, so "requested" and "booked"
     stay distinguishable after the screen closes. */
  const sendPlan = useCallback(() => {
    if (!plan) return;
    const day = S.formatDay(plan.day, lang, t);
    const added = plan.rows.filter((r) => r.biz).map((r) => {
      const booked = Boolean(r.slot) && availability.tierOf(r.biz) === 'connected';
      const when = r.slot ? `${day} · ${S.formatSlot(r.slot, lang)}` : '';
      const key = booked ? 'plLogBooked' : r.slot ? 'plLogRequested' : 'plLogAsked';
      return {
        id: `${r.biz.id}-${r.service}-${Date.now()}`,
        who: bizName(r.biz),
        text: t(key).replace('{when}', when).replace('{svc}', catLabel(r.service)),
      };
    });
    setNotes((prev) => [...added, ...prev]);
    const n = tallyPlan(plan, availability.tierOf);
    closePlan();
    showToast(n.connected && !n.declared && !n.unknown ? t('plSentBooked') : t('plSent'));
  }, [plan, lang, t, closePlan, showToast, availability.tierOf, bizName, catLabel]);

  const feed = useMemo(
    () => ranking.order(businesses.BIZ, { interests, language: serveLanguage, tierOf: availability.tierOf }),
    [interests, serveLanguage, availability.tierOf],
  );
  const categoryList = useMemo(
    () => (category
      ? ranking.order(businesses.byCategory(category), { interests, language: serveLanguage, tierOf: availability.tierOf })
      : []),
    [category, interests, serveLanguage, availability.tierOf],
  );
  const anySample = Boolean(plan && plan.rows.some((r) => r.biz
    && availability.tierOf(r.biz) !== 'unknown' && !availability.answered(r.biz.id)));
  const swapRow = plan && swapService ? plan.rows.find((r) => r.service === swapService) : null;

  // Opening the inbox marks what is in it as read.
  useEffect(() => { if (tab === 'inbox') setSeen(notes.length); }, [tab, notes.length]);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const countLabel = (n) => `${n} ${n === 1 ? t('catOne') : t('catAll')}`;
  const toastTransition = reduced ? { duration: 0 } : { duration: durations.swap, ease };
  const poster = (b, i) => (
    <Poster
      key={b.id}
      biz={b}
      onOpen={openBiz}
      priority={i < 3}
      isLive={availability.isLive(b.id)}
      tier={availability.tierOf(b)}
    />
  );

  return (
    <div className="stage">
      <div className="phone">
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
          <Rail
            title={t('rowTrusted')}
            action={<button type="button" className="whybtn" onClick={() => setWhy(true)}>{t('whyOrder')}</button>}
          >
            {feed.map(poster)}
          </Rail>
        </Screen>

        <Screen id={`browse:${category || 'all'}`} active={tab === 'browse'}>
          {category ? (
            <>
              <div className="backbar">
                <button type="button" onClick={() => setCategory(null)}>← {t('backBrowse')}</button>
              </div>
              <div className="head">
                <h2>{catLabel(category)}</h2>
                <p>{countLabel(categoryList.length)}</p>
              </div>
              {categoryList.length ? (
                <div className="stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {categoryList.map(poster)}
                </div>
              ) : (
                <div className="empty"><p>{t('catNone')}</p><span>{t('catNoneSub')}</span></div>
              )}
            </>
          ) : (
            <>
              <div className="head"><h2>{t('browseTitle')}</h2><p>{t('browseSub')}</p></div>
              <div className="stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {businesses.CATS.map((c) => (
                  <button type="button" className="card" key={c[0]} onClick={() => setCategory(c[0])}>
                    <div className={`pic ${c[2]}`} style={{ height: 96, overflow: 'hidden', position: 'relative' }}>
                      <Photo name={c[3]} />
                    </div>
                    <div className="b" style={{ padding: '11px 12px 13px' }}>
                      <p className="t" style={{ fontSize: '.92rem' }}>{lang === 'ko' ? c[1] : c[0]}</p>
                      <p className="s" style={{ fontSize: '.78rem' }}>{countLabel(businesses.byCategory(c[0]).length)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </Screen>

        <Screen id="inbox" active={tab === 'inbox'}>
          <div className="head"><h2>{t('tabInbox')}</h2></div>
          {notes.length ? (
            <div className="stack">
              {notes.map((n) => (
                <div className="row" key={n.id}>
                  <div className="bd"><p className="t">{n.who}</p><p className="s">{n.text}</p></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty"><p>{t('inboxEmpty')}</p></div>
          )}
        </Screen>

        {['community', 'saved', 'you'].map((k) => (
          <Screen id={k} active={tab === k} key={k}>
            <div className="head"><h2>{t(`tab${k[0].toUpperCase()}${k.slice(1)}`)}</h2></div>
            <div className="empty"><p>{t('comingSoon')}</p></div>
          </Screen>
        ))}

        <AnimatePresence>
          {toast && (
            <motion.div
              key="toast"
              className="toast on"
              role="status"
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={toastTransition}
            >
              <span>{toast}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <Deck
          tab={tab}
          onTab={(k) => { if (k === 'browse' && tab === 'browse') setCategory(null); setTab(k); }}
          query={query}
          onOpenSearch={() => setSearchOpen(true)}
          listening={speech.listening}
          onMic={speech.toggle}
          unread={Math.max(0, notes.length - seen)}
          island={island}
          onIslandClose={() => { hideIsland(); setTab('inbox'); }}
        />

        <SearchScreen
          open={searchOpen}
          query={query}
          onQuery={setQuery}
          onClose={() => setSearchOpen(false)}
          onSubmit={(text) => { setSearchOpen(false); runQuery(text); }}
          listening={speech.listening}
          onMic={speech.toggle}
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
              {explain().map((x) => <span className="vb b" key={x.category}>{catLabel(x.category)} ×{x.count}</span>)}
            </div>
          ) : <p className="note">{t('whyNone')}</p>}
          <p className="note" style={{ marginTop: 12 }}>{t('whyHousing')}</p>
          <p className="note" style={{ marginTop: 10 }}>{t('whyLocal')}</p>
        </Sheet>

        <AnimatePresence>
          {plan && (
            <PlanScreen
              key="plan"
              plan={plan}
              tally={tallyPlan(plan, availability.tierOf)}
              tierOf={availability.tierOf}
              anySample={anySample}
              onClose={closePlan}
              onSwap={setSwapService}
              onSend={sendPlan}
              onAdjust={() => showToast(t('plAdjustPh'))}
            />
          )}
        </AnimatePresence>

        <Sheet
          raised
          open={Boolean(swapRow)}
          onClose={() => setSwapService(null)}
          title={swapRow ? t('swapTitle').replace('{svc}', catLabel(swapRow.service)) : ''}
          sub={t('swapSub')}
        >
          {swapRow && (
            <div className="stack" style={{ padding: 0 }}>
              {swapRow.alternatives.map((b) => {
                const current = Boolean(swapRow.biz) && b.id === swapRow.biz.id;
                const tier = availability.tierOf(b);
                const dd = availability.dayOf(b.id, plan.day, tier);
                const first = dd.open.find((x) => !dd.taken.includes(x));
                return (
                  <button
                    type="button"
                    className="row"
                    key={b.id}
                    aria-current={current ? 'true' : undefined}
                    onClick={() => (current ? setSwapService(null) : chooseSwap(swapRow.service, b))}
                  >
                    <span className={`av ${b.g}`} style={{ position: 'relative', overflow: 'hidden' }}><Photo name={b.sc} /></span>
                    <span className="bd">
                      <span className="t" style={{ display: 'block' }}>{bizName(b)}</span>
                      <span className="s" style={{ display: 'block' }}>
                        ★ {b.r} · {first ? `${S.formatDay(plan.day, lang, t)} ${S.formatSlot(first, lang)}` : t('swapNoTime')}
                      </span>
                    </span>
                    <span className={`tagp ${current ? 'n' : tier === 'connected' ? 'ok' : 'w'}`}>
                      {current ? t('swapCurrent') : t(TIER_KEY[tier] || 'avAsk')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </Sheet>
      </div>
    </div>
  );
}

export default function App() {
  return <LangProvider><Shell /></LangProvider>;
}
