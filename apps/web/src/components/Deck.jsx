/**
 * The bottom control deck.
 *
 * Everything reachable with one thumb, floating so content scrolls behind it.
 * The language button sits beside the search field because for this audience
 * it is a primary control, not a preference three screens deep.
 *
 * The microphone's listening state is carried by fill, glyph and label
 * together - never by the pulse alone, which prefers-reduced-motion switches
 * off. Its accessible name says what it does ("Ask with your voice"), not the
 * error message it used to carry.
 */
import { AnimatePresence, motion } from 'motion/react';
import { useLang } from '../lib/useLang.jsx';
import { durations, spring, useReducedMotion, useTransition } from '../lib/motion.js';

const TABS = [
  ['home', 'tabHome'], ['browse', 'tabBrowse'], ['community', 'tabCommunity'],
  ['saved', 'tabSaved'], ['inbox', 'tabInbox'], ['you', 'tabYou'],
];

export default function Deck({
  tab, onTab, query, onQuery, onSubmit, listening, onMic, unread, island, onIslandClose,
}) {
  const { lang, setLang, t } = useLang();
  const press = useTransition({ duration: durations.press });
  const reduced = useReducedMotion();

  return (
    <div className="deck">
      <AnimatePresence>
        {island && (
          <motion.button
            key="island"
            type="button"
            className="island on"
            aria-live="polite"
            initial={reduced ? false : { opacity: 0, y: 16, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.94, transition: { duration: durations.swap } }}
            transition={reduced ? { duration: 0 } : spring}
            onClick={onIslandClose}
          >
            <span className="ibd">
              <span className="it">{island.title}</span>
              <span className="im">{island.message}</span>
            </span>
            <span className="ix" aria-hidden="true">✕</span>
          </motion.button>
        )}
      </AnimatePresence>

      <form className="searchdock" role="search" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t('searchPh')}
          aria-label={t('searchPh')}
          autoComplete="off"
          enterKeyHint="search"
        />
        <button
          type="button"
          className="langbtn"
          onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
          aria-label={t('language')}
        >
          {lang === 'ko' ? '한' : 'EN'}
        </button>
        <motion.button
          type="button"
          className={`voicebtn${listening ? ' live' : ''}`}
          onClick={onMic}
          whileTap={{ scale: 0.96 }}
          transition={press}
          aria-label={listening ? t('vsListening') : t('askVoice')}
          aria-pressed={listening}
        >
          <span aria-hidden="true">{listening ? '■' : '●'}</span>
        </motion.button>
      </form>

      <nav className="tabs">
        {TABS.map(([k, key]) => (
          <motion.button
            key={k}
            type="button"
            className={`tab${tab === k ? ' on' : ''}`}
            onClick={() => onTab(k)}
            whileTap={{ scale: 0.96 }}
            transition={press}
            aria-current={tab === k ? 'page' : undefined}
          >
            {k === 'inbox' && unread > 0 && <span className="dot">{unread}</span>}
            <span>{t(key)}</span>
          </motion.button>
        ))}
      </nav>
    </div>
  );
}
