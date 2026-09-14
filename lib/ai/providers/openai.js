'use strict';

/**
 * OpenAI provider. Same `complete()` contract as the Gemini one so the caller
 * cannot tell them apart. Requires OPENAI_API_KEY.
 */

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4.1-mini';
const TIMEOUT_MS = 12000;

async function complete({ system, user, model = DEFAULT_MODEL, json = false, fetchImpl = globalThis.fetch, apiKey = process.env.OPENAI_API_KEY }) {
  if (!apiKey) return { ok: false, error: 'unconfigured', unconfigured: true };

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: user });

    const res = await fetchImpl(ENDPOINT, {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0,
        max_tokens: 400,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { ok: false, error: `openai ${res.status}`, detail: detail.slice(0, 300) };
    }
    const body = await res.json();
    const text = body?.choices?.[0]?.message?.content || '';
    return { ok: true, text, provider: 'openai', model };
  } catch (err) {
    return { ok: false, error: err && err.name === 'AbortError' ? 'openai timed out' : 'openai unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { complete, DEFAULT_MODEL };
