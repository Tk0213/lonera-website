/**
 * Voice input, through the browser's own speech recognition.
 *
 * The deck's microphone used to show "voice needs a microphone" on every tap,
 * including in browsers that support speech perfectly well, and it carried
 * that error sentence as its accessible name - a screen reader announced the
 * button as a failure message. This wires the Web Speech API where it exists
 * and keeps that message for where it genuinely does not.
 *
 * This code sends nothing anywhere. The browser's recogniser may use its
 * vendor's servers; that disclosure is the browser's to make.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const DENIED = new Set(['not-allowed', 'service-not-allowed', 'audio-capture']);

export function useSpeech({ lang, onResult, onUnavailable }) {
  const [listening, setListening] = useState(false);
  const rec = useRef(null);
  const live = useRef(false);
  const handlers = useRef({ onResult, onUnavailable });

  useEffect(() => { handlers.current = { onResult, onUnavailable }; });
  useEffect(() => () => { try { if (rec.current) rec.current.abort(); } catch { /* gone */ } }, []);

  const toggle = useCallback(() => {
    if (live.current && rec.current) {
      try { rec.current.stop(); } catch { /* already stopping */ }
      return;
    }
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) { if (handlers.current.onUnavailable) handlers.current.onUnavailable(); return; }

    const r = new SR();
    r.lang = lang === 'ko' ? 'ko-KR' : 'en-CA';
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i += 1) text += e.results[i][0].transcript;
      if (handlers.current.onResult) handlers.current.onResult(text, e.results[e.results.length - 1].isFinal);
    };
    r.onerror = (e) => {
      if (DENIED.has(e.error) && handlers.current.onUnavailable) handlers.current.onUnavailable();
    };
    r.onend = () => { live.current = false; setListening(false); };
    rec.current = r;
    try {
      r.start();
      live.current = true;
      setListening(true);
    } catch {
      live.current = false;
      setListening(false);
      if (handlers.current.onUnavailable) handlers.current.onUnavailable();
    }
  }, [lang]);

  return { listening, toggle };
}
