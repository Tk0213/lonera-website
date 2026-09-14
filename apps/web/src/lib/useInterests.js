/**
 * On-device interest profile.
 *
 * The privacy property is structural, not a promise: this hook is the only
 * thing that touches storage, @lonera/core's ranking takes the counts as an
 * argument, and nothing sends them anywhere. There is no profile on a server
 * to breach, subpoena or sell.
 *
 * Every read and write is wrapped, because storage genuinely throws in a
 * private window, with site data blocked, and inside some embedded previews.
 * A ranking feature must never be the reason the app fails to start.
 */
import { useCallback, useState } from 'react';
import { ranking } from '@lonera/core';

const KEY = 'lonera.interests';

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch { return {}; }
}

export function useInterests() {
  const [interests, setInterests] = useState(load);

  const note = useCallback((category) => {
    setInterests((prev) => {
      const next = ranking.noteInterest(prev, category);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* fine */ }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setInterests({});
    try { localStorage.removeItem(KEY); } catch { /* fine */ }
  }, []);

  return { interests, note, clear, explain: () => ranking.explain(interests) };
}
