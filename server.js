'use strict';

/**
 * Lonera server.
 *
 * Serves the three static pages and exposes the availability and AI layers.
 * Security posture is deliberate rather than default: the previous version was
 * `express.static(__dirname)` over the repository root, which served
 * package.json, .git and every dotfile to anyone who asked.
 */

const express = require('express');
const path = require('path');
const crypto = require('crypto');

const availability = require('./lib/availability');
const aiIntent = require('./lib/ai/intent');
const businesses = require('./lib/businesses');

const app = express();
const PORT = process.env.PORT || 3000;
const PROD = process.env.NODE_ENV === 'production';

app.disable('x-powered-by'); // do not advertise the stack

/* ------------------------------------------------------------------ security */

/**
 * Security headers, set by hand rather than pulling in helmet: this is the
 * whole of what the app needs and a dependency we do not add is a dependency
 * we do not have to patch.
 *
 * The CSP is strict-dynamic-free on purpose - the pages carry inline <style>
 * and inline <script>, so 'unsafe-inline' for those two is load-bearing until
 * the app is refactored to external files. It is written out explicitly so the
 * trade is visible instead of implied. Everything else is locked down: no
 * remote script, no framing, no object, images limited to self and data: URIs
 * (which is exactly how the app embeds its photography).
 */
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",   // TODO: drop once the inline app script moves to a file
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'none'",
  ].join('; '));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), payment=(), usb=()');
  if (PROD) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

/** Body cap: these endpoints take a sentence, not a payload. */
app.use(express.json({ limit: '16kb' }));

/**
 * Fixed-window rate limit, in memory.
 *
 * Enough for one process and honest about it: the AI routes cost real money
 * per call, so an unauthenticated endpoint in front of them needs a brake even
 * in a prototype. Behind more than one instance this needs to move to a shared
 * store, which is noted rather than silently assumed.
 */
function rateLimit({ windowMs, max, key = 'global' }) {
  const hits = new Map();
  setInterval(() => hits.clear(), windowMs).unref();
  return (req, res, next) => {
    const id = `${key}:${req.ip}`;
    const n = (hits.get(id) || 0) + 1;
    hits.set(id, n);
    if (n > max) {
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
      return res.status(429).json({ error: 'too many requests' });
    }
    return next();
  };
}

/* -------------------------------------------------------------------- static */

// Serve only the files that are meant to be public. The previous
// express.static(__dirname) exposed package.json, server.js, .git and the
// design-system bundle to the open internet.
const PUBLIC_FILES = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/dashboard': 'dashboard.html',
  '/dashboard.html': 'dashboard.html',
  '/app': 'app-preview.html',
  '/app-preview.html': 'app-preview.html',
  '/thumbnail.png': 'thumbnail.png',
};

for (const [route, file] of Object.entries(PUBLIC_FILES)) {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, file), {
      headers: { 'Cache-Control': PROD ? 'public, max-age=300' : 'no-store' },
    });
  });
}

/* ----------------------------------------------------------------- endpoints */

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    availability: 'up',
    ai: {
      gemini: Boolean(process.env.GEMINI_API_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY),
    },
    places: Boolean(process.env.GOOGLE_PLACES_API_KEY),
  });
});

/**
 * GET /api/availability/:bizId
 *
 * Returns slots plus the tier they came from. Callers must read `tier` and
 * `bookable`, not just `slots`: a DECLARED answer is a hint, and rendering it
 * as a confirmed booking is how you double-book a real person.
 */
app.get('/api/availability/:bizId',
  rateLimit({ windowMs: 60_000, max: 120, key: 'avail' }),
  async (req, res) => {
    const id = String(req.params.bizId || '');
    if (!/^[a-z0-9_-]{1,40}$/i.test(id)) return res.status(400).json({ error: 'bad id' });

    const biz = businesses.get(id);
    if (!biz) return res.status(404).json({ error: 'unknown business' });

    const horizonDays = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 30);
    try {
      const out = await availability.resolve(biz, { horizonDays });
      res.setHeader('Cache-Control', 'no-store');
      return res.json(out);
    } catch (err) {
      // never leak a stack to the client
      console.error('[availability]', id, err && err.message);
      return res.status(502).json({ error: 'availability unavailable' });
    }
  });

/**
 * POST /api/ai/intent  { text }
 *
 * Google or OpenAI parses the utterance; the caller falls back to the app's
 * own matcher when neither is configured or reachable. Output is validated
 * against a fixed enum before it leaves here, so a hallucinated category
 * cannot reach the client.
 */
app.post('/api/ai/intent',
  rateLimit({ windowMs: 60_000, max: 20, key: 'ai' }),
  async (req, res) => {
    const text = req.body && typeof req.body.text === 'string' ? req.body.text : '';
    if (!text.trim()) return res.status(400).json({ error: 'text required' });
    if (text.length > 500) return res.status(413).json({ error: 'text too long' });

    try {
      const out = await aiIntent.parse(text);
      res.setHeader('Cache-Control', 'no-store');
      if (!out.ok) {
        // 200 with fallback:true - the client has a working local parser, so
        // this is a degraded answer rather than an error
        return res.json({ ok: false, fallback: true, reason: out.error });
      }
      return res.json({ ok: true, intent: out.intent, provider: out.provider });
    } catch (err) {
      console.error('[ai/intent]', err && err.message);
      return res.status(502).json({ error: 'intent unavailable' });
    }
  });

/* ---------------------------------------------------------------- fallthrough */

app.use((req, res) => res.status(404).json({ error: 'not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const ref = crypto.randomBytes(4).toString('hex');
  console.error(`[error ${ref}]`, err && err.stack);
  res.status(500).json({ error: 'internal error', ref });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Lonera server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
