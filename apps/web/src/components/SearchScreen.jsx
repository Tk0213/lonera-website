/**
 * Search, full screen.
 *
 * Tapping the deck's search field opens this instead of typing into a 46px
 * strip under the thumb. The reason is the audience: a 68-year-old reading
 * Korean on a five-year-old phone should not have to aim at a small field
 * whose text is smaller still. So the field becomes the screen - one big
 * input, one big microphone, nothing else competing for the eye.
 *
 * Layout of the bottom row, and why: the microphone is centred because it is
 * the easiest control to hit without looking, and voice is the way in for
 * anyone who finds typing Korean or English on a phone slow. Language sits
 * immediately to its right, where it is reachable with the same thumb and
 * visible at the moment someone is deciding which language to speak in.
 * Search sits to the left of the microphone so the row stays symmetrical and
 * the microphone stays in the middle of the screen, not just in the middle of
 * a group of three.
 *
 * Every control here is at least 56px, every label reads at 1rem or more, and
 * the listening state is carried by colour, glyph and a written line - not by
 * the pulse, which prefers-reduced-motion switches off.
 */
import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useLang } from '../lib/useLang.jsx';
import { useLayer } from '../lib/useLayer.js';
import { durations, ease, spring, useReducedMotion, useTransition } from '../lib/motion.js';

const EXAMPLES = ['searchEx1', 'searchEx2', 'searchEx3'];

export default function SearchScreen({
  open, query, onQuery, onClose, onSubmit, listening, onMic,
}) {
  const { lang, setLang, t } = useLang();
  const reduced = useReducedMotion();
  const press = useTransition({ duration: durations.press });
  const inputRef = useRef(null);

  useLayer(open, { onEscape: onClose, focusRef: inputRef });

  /* The caret belongs at the end of what is already typed, not selecting it:
     someone reopening search to add a word should not wipe it by typing. */
  useEffect(() => {
    if (!open || !inputRef.current) return;
    const el = inputRef.current;
    const n = el.value.length;
    try { el.setSelectionRange(n, n); } catch { /* not all inputs allow it */ }
  }, [open]);

  const submit = (e) => {
    e.preventDefault();
    if (!query.trim()) { inputRef.current && inputRef.current.focus(); return; }
    onSubmit(query);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="searchfull"
          role="dialog"
          aria-modal="true"
          aria-label={t('searchPh')}
          initial={reduced ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 18, transition: { duration: durations.swap, ease } }}
          transition={reduced ? { duration: 0 } : spring}
        >
          <div className="sf-top">
            <button type="button" className="sf-cancel" onClick={onClose}>
              {t('searchCancel')}
            </button>
          </div>

          <form className="sf-form" role="search" onSubmit={submit}>
            <div className="sf-field">
              <input
                ref={inputRef}
                className="sf-input"
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                placeholder={t('searchPh')}
                aria-label={t('searchPh')}
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                enterKeyHint="search"
              />
              {query && (
                <button
                  type="button"
                  className="sf-clear"
                  onClick={() => { onQuery(''); inputRef.current && inputRef.current.focus(); }}
                  aria-label={t('searchClear')}
                >
                  <span aria-hidden="true">✕</span>
                </button>
              )}
            </div>

            <p className="sf-hint" aria-live="polite">
              {listening ? t('vsListening') : t('searchSpeakHint')}
            </p>

            <div className="sf-examples">
              <p className="sf-exlabel">{t('searchTry')}</p>
              {EXAMPLES.map((key) => (
                <button
                  type="button"
                  className="sf-ex"
                  key={key}
                  onClick={() => { onQuery(t(key)); onSubmit(t(key)); }}
                >
                  {t(key)}
                </button>
              ))}
            </div>

            {/* Search · microphone · language. The microphone is the middle of
                the screen, with the other two balanced around it. */}
            <div className="sf-controls">
              <button type="submit" className="sf-side" aria-label={t('vsGo')}>
                <span className="sf-sideglyph" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.6-3.6" />
                  </svg>
                </span>
                <span className="sf-sidelabel">{t('vsGo')}</span>
              </button>

              <motion.button
                type="button"
                className={`sf-mic${listening ? ' live' : ''}`}
                onClick={onMic}
                whileTap={reduced ? undefined : { scale: 0.96 }}
                transition={press}
                aria-labelledby="sf-miclabel"
                aria-pressed={listening}
              >
                <span aria-hidden="true">
                  {listening ? (
                    <svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor">
                      <rect x="6" y="6" width="12" height="12" rx="2.5" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
                      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" stroke="none" />
                      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
                      <path d="M12 18v3" />
                    </svg>
                  )}
                </span>
              </motion.button>

              <button
                type="button"
                className="sf-side"
                onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
                aria-label={`${t('language')}: ${lang === 'ko' ? 'English' : '한국어'}`}
              >
                {/* Both the mark and the word name the language you get by
                    pressing it. The deck's small button shows the current
                    language instead, and showing one of each here read as a
                    contradiction. */}
                <span className="sf-sideglyph sf-lang" aria-hidden="true">{lang === 'ko' ? 'EN' : '한'}</span>
                <span className="sf-sidelabel">{lang === 'ko' ? 'English' : '한국어'}</span>
              </button>
            </div>

            <p className="sf-miclabel" id="sf-miclabel">{listening ? t('tapStop') : t('tapSpeak')}</p>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
