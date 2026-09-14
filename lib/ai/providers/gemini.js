'use strict';

/**
 * Google Gemini provider.
 *
 * Kept deliberately thin: one `complete()` that takes a system instruction and
 * a user string and returns text. Structure, validation and fallback live in
 * lib/ai/intent.js so both providers are interchangeable and neither one's
 * response shape leaks into the caller.
 *
 * Requires GEMINI_API_KEY.
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const TIMEOUT_MS = 12000;

async function complete({ system, user, model = DEFAULT_MODEL, json = false, fetchImpl = globalThis.fetch, apiKey = process.env.GEMINI_API_KEY }) {
  if (!apiKey) return { ok: false, error: 'unconfigured', unconfigured: true };

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 400,
          ...(json ? { responseMimeType: 'application/json' } : {}),
        },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { ok: false, error: `gemini ${res.status}`, detail: detail.slice(0, 300) };
    }
    const body = await res.json();
    const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
    return { ok: true, text, provider: 'gemini', model };
  } catch (err) {
    return { ok: false, error: err && err.name === 'AbortError' ? 'gemini timed out' : 'gemini unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { complete, DEFAULT_MODEL };
