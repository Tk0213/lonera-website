/**
 * Language.
 *
 * Korean is half the product, not a setting buried in a preferences screen, so
 * the switch lives in the bottom deck next to the search field and changing it
 * re-renders everything at once. `t` comes straight from @lonera/core, which
 * holds the only copy of both languages.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { i18n } from '@lonera/core';

const Ctx = createContext(null);
const KEY = 'lonera.lang';

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'en' || saved === 'ko') return saved;
    } catch { /* private mode, blocked storage */ }
    // Guess from the browser once, then never again - an explicit choice wins.
    return typeof navigator !== 'undefined' && /^ko/i.test(navigator.language || '') ? 'ko' : 'en';
  });

  const choose = useCallback((next) => {
    setLang(next);
    try { localStorage.setItem(KEY, next); } catch { /* nothing to do */ }
    if (typeof document !== 'undefined') document.documentElement.lang = next;
  }, []);

  const value = useMemo(() => ({
    lang,
    setLang: choose,
    t: i18n.makeT(lang),
    langs: i18n.LANGS,
  }), [lang, choose]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLang outside LangProvider');
  return v;
}
