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
const fs = require('node:fs');
const crypto = require('crypto');

/** Repository root. Served pages live in apps/site and apps/prototype. */
const ROOT = path.resolve(__dirname, '..', '..');

const availability = require('./src/availability');
const aiIntent = require('./src/ai/intent');
const businesses = require('./src/businesses');
const { expandV6 } = require('./src/net/guard');
const { waitlist } = require('@lonera/core');

/* ------------------------------------------------------------- page assembly
 *
 * Two problems solved in one place, at startup.
 *
 * 1. app-preview.html is an artifact *body*: no doctype, no <head>. The
 *    artifact host supplies those. Served raw by this server it got neither,
 *    which meant no viewport meta - so the mobile media queries never fired
 *    and the app rendered at desktop width on a phone, with the bottom control
 *    deck off screen. It also parsed in quirks mode. So the document is
 *    assembled here rather than shipped half-built.
 *
 * 2. The CSP carried script-src 'unsafe-inline', which gives away most of the
 *    value of having a CSP: it means any injected <script> executes. None of
 *    these pages use inline event handlers or javascript: URLs (checked), so
 *    their inline scripts are allowed by hash instead. Each page names the
 *    exact scripts that belong to it and nothing else runs - an injected
 *    script has no matching hash. This is the part of CSP that stops XSS,
 *    and it is now strict.
 *
 *    style-src still carries 'unsafe-inline', deliberately, and it is worth
 *    being exact about why rather than leaving a TODO. CSP hashes cover
 *    <style> *elements* but not style *attributes*, and the app renders 57
 *    of those inside its templates. Verified by measurement: with style-src
 *    on hashes alone the browser blocked 96 inline styles and the layout came
 *    apart, while every script still ran. The alternatives are 'unsafe-hashes'
 *    with a hash per attribute value - which cannot cover the two that are
 *    built from variables - or moving all 57 into classes, a refactor touching
 *    every view in a 2MB file with real regression risk in each one.
 *
 *    The residual risk is bounded and specific: an attacker who could already
 *    inject markup could style the page, and CSS-based exfiltration is a
 *    known class of attack. What makes that acceptable here is that there is
 *    no injection path to reach it - every interpolation goes through esc(),
 *    there is no user-generated HTML, no credential form, and no token in the
 *    DOM to read. Moving those attributes into classes is the way to close it
 *    properly, and it is a refactor rather than a header change.
 *
 * Hashes are computed from the assembled bytes, so they cannot drift from
 * what is served: there is no build step to forget to run.
 */
const HEAD = [
  '<!doctype html>',
  '<html lang="en">',
  '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
  '<meta name="color-scheme" content="light">',
  '<meta name="theme-color" content="#ffffff">',
  '<meta name="referrer" content="no-referrer">',
  '<title>Lonera</title>',
  '<style>:root{color-scheme:light}html,body{margin:0;padding:0}img{max-width:100%}</style>',
  '</head>',
  '<body>',
].join('\n');

/** sha256 of an inline block, in the form a CSP expects. */
function cspHash(text) {
  return `'sha256-${crypto.createHash('sha256').update(text, 'utf8').digest('base64')}'`;
}

/** Read one page, assemble it if it is a bare body, and hash its inline blocks. */
function preparePage(file) {
  const raw = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const isBody = !/^\s*<!doctype/i.test(raw) && !/<html[\s>]/i.test(raw);
  const html = isBody ? `${HEAD}\n${raw}\n</body>\n</html>\n` : raw;
  const scripts = [];
  const re = /<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) scripts.push(cspHash(m[1]));
  return { html, scripts, wrapped: isBody };
}

const app = express();
const PORT = process.env.PORT || 3000;
const PROD = process.env.NODE_ENV === 'production';

app.disable('x-powered-by'); // do not advertise the stack
app.disable('etag');         // API answers are no-store; an ETag only invites cache probing

/* Express does not trust proxy headers by default and this depends on that:
   rateLimit() keys on req.ip, so if `trust proxy` were switched on without a
   matching proxy in front, anyone could reset their own limit by sending an
   X-Forwarded-For header. Verified: spoofing it does not lift the limit. */

/* ------------------------------------------------------------------ security */

/**
 * Security headers, set by hand rather than pulling in helmet: this is the
 * whole of what the app needs and a dependency we do not add is a dependency
 * we do not have to patch.
 *
 * Scripts: no 'unsafe-inline'. Each page's own inline scripts are allowed by
 * their SHA-256 hash (see csp() below), so an injected <script> or onerror=
 * handler does not run. Styles do keep 'unsafe-inline', for the reason given
 * in csp(). Everything else is locked down: no remote script, no framing, no
 * object, no connections off-site, images limited to self and data: URIs.
 */
/** The shared part of every policy; the inline allowances are added per page. */
function csp(scriptHashes = []) {
  return [
    "default-src 'self'",
    `script-src 'self' ${scriptHashes.join(' ')}`.trim(),
    // No hashes here, and that is not an oversight: per CSP, a hash or nonce
    // in a directive makes the browser IGNORE 'unsafe-inline' in that same
    // directive. Listing both blocked every style attribute while looking
    // permissive - the sheet photo collapsed to 0px and the browse grid lost
    // its columns. It is one or the other, so style-src is 'unsafe-inline'
    // alone until those attributes become classes. script-src keeps its
    // hashes and no 'unsafe-inline', which is where the protection matters.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'none'",
  ].join('; ');
}

app.use((req, res, next) => {
  // Endpoints and anything without its own page policy get the strictest one:
  // no inline anything. Pages overwrite this with their own hashes below.
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
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

/* A body that is malformed or too big is the client's mistake, not ours.
   Without this the parser's error reached the generic handler and came back
   as 500 - which reads as "the server broke", logs a stack for something
   entirely routine, and tells an attacker probing limits nothing useful
   apart from how to make the logs noisy. */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (!err || !err.type) return next(err);
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'body too large' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid json' });
  return next(err);
});

/**
 * Fixed-window rate limit, in memory.
 *
 * Enough for one process and honest about it: the AI routes cost real money
 * per call, so an unauthenticated endpoint in front of them needs a brake even
 * in a prototype. Behind more than one instance this needs to move to a shared
 * store, which is noted rather than silently assumed.
 */
/**
 * Who a rate limit counts as one caller.
 *
 * An IPv6 address is not one caller: a home connection is routinely handed a
 * whole /64, which is 2^64 addresses. Keyed on the full address, anyone on
 * IPv6 could rotate through them and never meet a limit - the AI routes would
 * be as good as unmetered. So IPv6 is counted per /64, the smallest block an
 * ISP assigns, and an IPv4-mapped address is counted as the IPv4 it is.
 */
function clientKey(ip) {
  const raw = String(ip || '');
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(raw);
  if (mapped) return mapped[1];
  if (!raw.includes(':')) return raw;
  const groups = expandV6(raw.toLowerCase().split('%')[0]);
  return groups ? `${groups.slice(0, 4).map((g) => g.toString(16)).join(':')}::/64` : raw;
}

function rateLimit({ windowMs, max, key = 'global' }) {
  const hits = new Map();
  setInterval(() => hits.clear(), windowMs).unref();
  return (req, res, next) => {
    const id = `${key}:${clientKey(req.ip)}`;
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
  '/': 'apps/site/index.html',
  '/index.html': 'apps/site/index.html',
  '/dashboard': 'apps/site/dashboard.html',
  '/dashboard.html': 'apps/site/dashboard.html',
  '/app': 'apps/prototype/app-preview.html',
  '/app-preview.html': 'apps/prototype/app-preview.html',
  '/thumbnail.png': 'apps/site/thumbnail.png',
};

/* Prepared once at startup: assembling a 2MB document per request would be
   the slowest thing this server does. */
const PAGES = new Map();
for (const file of new Set(Object.values(PUBLIC_FILES))) {
  if (file.endsWith('.html')) PAGES.set(file, preparePage(file));
}

for (const [route, file] of Object.entries(PUBLIC_FILES)) {
  app.get(route, (req, res) => {
    res.setHeader('Cache-Control', PROD ? 'public, max-age=300' : 'no-store');
    if (!PAGES.has(file)) return res.sendFile(path.join(ROOT, file));
    /* Outside production, re-read on each request. Preparing the page once is
       right for a served deployment - assembling 2MB per request would be the
       slowest thing here - but in development it silently serves the file as
       it was at boot, so an edit appears to have done nothing and the CSP
       hash no longer matches what you are looking at. That cost me a
       debugging detour; it should not cost the next person one. */
    const page = PROD ? PAGES.get(file) : preparePage(file);
    res.setHeader('Content-Security-Policy', csp(page.scripts));
    res.type('html');
    return res.send(page.html);
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
    standby: Boolean(process.env.STANDBY_SECRET),
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

/* ------------------------------------------------------------------ standby */

/**
 * Standby queue endpoints.
 *
 * These are gated shut unless STANDBY_SECRET is set, and that is the whole
 * point rather than an inconvenience. The queue's value is that the order is
 * honest, and the order can only be honest if we know who is in it. With a
 * client-supplied user id and no signature, the first person to read the
 * network tab can:
 *
 *   - join as a hundred invented identities and occupy every place in a line,
 *     which is exactly the flooding the queue exists to prevent;
 *   - call leave with somebody else's id and take their place away.
 *
 * Neither is a clever exploit, they are just what an unauthenticated endpoint
 * means. So identity comes from an HMAC-signed token the server issued, and
 * with no secret configured the routes answer 503 instead of pretending to be
 * fair. Failing closed is the only correct default here: a queue that can be
 * stuffed is worse than no queue, because people rearrange their day around
 * a promise it cannot keep.
 */
const STANDBY_SECRET = process.env.STANDBY_SECRET || null;

/** Verify `userId.signature`, returning the id only if we really signed it. */
function identify(token) {
  if (!STANDBY_SECRET || typeof token !== 'string') return null;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;
  const id = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  const want = crypto.createHmac('sha256', STANDBY_SECRET).update(id).digest('base64url');
  // timingSafeEqual throws on a length mismatch, so compare lengths first
  if (sig.length !== want.length) return null;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want)) ? id : null;
}

function standbyGate(req, res, next) {
  if (!STANDBY_SECRET) {
    return res.status(503).json({ error: 'standby queue is not configured' });
  }
  const who = identify(req.get('X-Lonera-Token') || (req.body && req.body.token));
  if (!who) return res.status(401).json({ error: 'a signed identity is required' });
  req.who = who;
  return next();
}

const standbyLimit = rateLimit({ windowMs: 60_000, max: 30, key: 'standby' });

function readSlotArgs(req, res) {
  const bizId = String(req.params.bizId || '');
  if (!/^[a-z0-9_-]{1,40}$/i.test(bizId)) { res.status(400).json({ error: 'bad id' }); return null; }
  if (!businesses.get(bizId)) { res.status(404).json({ error: 'unknown business' }); return null; }
  const day = Number(req.body && req.body.day);
  if (!Number.isInteger(day) || day < 0 || day > 30) { res.status(400).json({ error: 'bad day' }); return null; }
  /* Only the canonical label every client sends ("9:30 AM"). Anything looser
     let a caller open lines under any 24 characters at all - "zzz", "25:99" -
     which cost nothing to create and clutter the queue.
     This checks the shape, not the business's hours: a line for a real-looking
     time the business never offers stays empty, because a release only ever
     comes from a slot that actually freed. */
  const slot = typeof (req.body && req.body.slot) === 'string' ? req.body.slot.trim() : '';
  if (!/^(1[0-2]|[1-9]):[0-5]\d (AM|PM)$/.test(slot)) {
    res.status(400).json({ error: 'bad slot' }); return null;
  }
  return { bizId, day, slot };
}

app.post('/api/standby/:bizId/join', standbyLimit, standbyGate, (req, res) => {
  const a = readSlotArgs(req, res);
  if (!a) return undefined;
  const biz = businesses.get(a.bizId);
  // The tier rule again: only a business with a real calendar can have a slot
  // taken on their behalf. Everyone else can be asked, never auto-booked.
  const autoBook = req.body.autoBook !== false && Boolean(biz.icsUrl);
  const out = waitlist.join(a.bizId, a.day, a.slot, req.who, { autoBook });
  if (!out.ok) return res.status(429).json({ error: out.error, max: out.max });
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ ok: true, position: out.position, autoBook, already: Boolean(out.already) });
});

app.post('/api/standby/:bizId/leave', standbyLimit, standbyGate, (req, res) => {
  const a = readSlotArgs(req, res);
  if (!a) return undefined;
  const left = waitlist.leave(a.bizId, a.day, a.slot, req.who);
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ ok: true, left });
});

app.get('/api/standby/mine', standbyLimit, standbyGate, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, lines: waitlist.forUser(req.who) });
});

/* Note there is deliberately no HTTP route that releases a slot. A release
   decides who gets an appointment, so it belongs to the calendar poller that
   noticed the cancellation - never to a caller who can simply ask for one.
   Exposed, it would let anyone drain a queue by claiming slots that never
   freed. */

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
/* exported for tests: the signature check is the whole of the queue's integrity */
module.exports.identify = identify;
module.exports.clientKey = clientKey;
