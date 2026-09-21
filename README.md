# Lonera

A bilingual (English / Korean) local-services marketplace for Calgary's
newcomer communities — Korean, Filipino, South Asian and Chinese.

Founders: TK Lim, Connor Kim.

**Everything here is a prototype.** Businesses, ratings, reviews, jobs and
dashboard figures are invented sample data. The app says so on first open.

## Layout

```
apps/
  web/         the React app (Vite). The product.
  server/      the API: availability, AI intent parsing, standby queue,
               and the static pages below
  site/        index.html (marketing site), dashboard.html (provider view)
  prototype/   app-preview.html — the original single-file prototype
packages/
  core/        logic shared by every app and the server
db/            schema.sql — Postgres schema (written, not yet run)
design-system/ generated Claude Design cards, plus hand-written directions
scripts/       build and wrap helpers
tests/         core/ · server/ · prototype/ — grouped by what they test
```

Nothing but configuration and documentation lives at the root. New code goes
in the folder that owns it; see `CLAUDE.md` for the rules.

## Running it

```bash
npm install          # workspaces: @lonera/core, @lonera/server, @lonera/web
npm start            # API + static pages on http://localhost:3000
npm run web          # the React app on http://localhost:5178 (proxies /api to 3000)
npm test             # 130 tests, no network required
```

Other tasks:

```bash
npm run web:build    # production build of the React app
npm run prototype    # wrap the single-file prototype so a static server can open it
npm run design       # regenerate design-system/ from the prototype's own CSS
npm audit --omit=dev # production dependencies
```

Requires **Node 22.12 or newer**: the CommonJS server imports the ESM core
package, which needs `require(esm)`.

## The three front ends, and why there are three

| | What it is | State |
| --- | --- | --- |
| `apps/web` | React + Vite. Imports `@lonera/core`. Real image files, code splitting, one scroll position per tab. | Home, Browse, business sheet with availability and standby, the multi-service planner. Community, Saved and You are placeholders. |
| `apps/prototype` | One self-contained HTML file, no build step. The original and still the most complete screen-by-screen build: messages, community, verification, the provider dashboard. | Kept as the reference and the shareable artifact. Carries its own copy of some logic, which is why two test files check the copies agree. |
| `apps/site` | The marketing site and provider dashboard, served by the API. | Static. |

`apps/prototype/app-preview.html` is written as an artifact *body* — no
doctype, no `<head>`, because the artifact host supplies them. Opened directly
it has no charset (Korean turns to mojibake) and no viewport meta (the mobile
media queries never fire). `npm run prototype` writes a wrapped copy beside it:

```bash
npm run prototype
python3 -m http.server 8934 --bind 127.0.0.1 --directory apps/prototype
open http://127.0.0.1:8934/app-harness.html
```

The server already wraps it: `/app` is a complete document.

## What is actually real

Real, and tested:

- **Availability tiers.** A business is `connected` (a calendar feed, the only
  source that can be called live), `declared` (hours they typed in) or
  `unknown` (nothing published). Nothing claims to be live without a feed.
- **iCal parsing**, with recurrence, cancellations and a streaming size cap.
- **An SSRF guard** on every outbound fetch, because feed URLs come from
  businesses. Cloud metadata, loopback and private ranges are refused, and
  every redirect hop is re-checked.
- **The standby queue.** Join a line for a taken slot; a cancellation goes to
  whoever was first, in a fixed order that timing cannot change.
- **Tutoring intent** → hard constraints and soft preferences, in both
  languages. Hard constraints filter, soft ones score, and a filtered slot is
  never scored back in.
- **Reservations**: hold, verify against the provider live, then confirm.
  Idempotent, and it fails closed when a provider cannot be reached.
- **Calendar events**: `.ics` with a stable UID and a rising SEQUENCE, plus a
  Google event body with a deterministic id so a retry cannot duplicate.
- **On-device interest ranking**, where language never ranks housing.

Not real yet:

- No database. `db/schema.sql` is written but has never been run.
- No accounts, no auth, no persistence. Reloading resets everything.
- No calendar connections: no OAuth, no webhooks, no calendar writes.
- No payments.
- Verification badges are decorative. Nothing is checked.
- The AI layer has no API key configured, so it falls back to the local
  parser. That fallback is the floor by design, not a stopgap.

## Known gaps worth stating plainly

- **Speech recognition has never run against a real microphone.** The wiring
  is standard and the typed paths are all verified, but every development
  browser in use blocked microphone access.
- **`db/schema.sql` is unverified.** No Postgres was available where it was
  written.
- **Vite's dev server has two open advisories** (path traversal in dev, and a
  Windows-only one). Production dependencies are clean; fixing the dev ones
  needs a major Vite upgrade.
- The prototype is a 2 MB single file. That is inherent to its format — the
  React app serves the same photographs as real files instead.

## Documents

- `CLAUDE.md` — conventions, the design-system loop, and the traps.
- `docs/architecture/` — the target platform architecture and the eleven
  decisions behind it, each with its reasons and what would change it.
- The booking-engine architecture write-up covers calendar integration,
  live availability, matching and double-booking prevention.

## Licence

Private prototype. Not licensed for redistribution.
