# Lonera

Bilingual (English / Korean) local-services marketplace for Calgary's newcomer
communities. See README.md for what the repo contains and how to run it.

## Where things go

Keep it organized as you work. That is a standing instruction, not a tidy-up
task for later.

```
apps/web/         React app (Vite). UI only - no business rules.
apps/server/      Express API. server.js at the top, server-only modules in src/.
apps/site/        Static marketing site and provider dashboard.
apps/prototype/   app-preview.html, the single-file prototype.
packages/core/    Everything two or more apps must agree on.
db/               SQL. Nothing else.
docs/architecture/  Target architecture + decision records (ADRs). A change
                  that contradicts an ADR updates the ADR in the same commit.
design-system/    Generated cards + hand-written directions.
scripts/          Build and wrap helpers.
tests/            core/ · server/ · prototype/, mirroring what they test.
```

Rules that keep it that way:

- **Nothing loose at the root.** Configuration and documentation only. A new
  file belongs in the folder that owns it.
- **A rule lives in exactly one place.** If the web app and the server both
  need it, it goes in `packages/core` and both import it. Two copies of one
  rule is how the housing-ranking rule and the standby order came to need
  dedicated drift tests.
- **`packages/core` takes no Node built-ins, no DOM and no network.** React
  Native has no `node:dns`; a browser has no `node:net`. Anything reaching for
  those belongs in `apps/server`.
- **Tests mirror the code.** A test for `packages/core` goes in `tests/core`.
- **Generated output is not committed.** `app-harness.html`, `apps/web/dist`,
  `graphify-out/` and `_gen/` are ignored. If a script can rebuild it, the
  script is what gets committed.
- Workspaces are listed explicitly in the root `package.json`. A new app or
  package has to be added there and needs its own `package.json`.

## Keep the design system in step with the app

The Claude Design project **Lonera Design System**
(`6a27b096-300e-4a43-ad92-73bfa8e65a69`) holds one preview card per component.
Those cards are **generated from `apps/prototype/app-preview.html`**, never
hand-written - `scripts/build-design-system.py` pulls the real rules out of the
app's own stylesheet, so a card cannot drift from what the app does.

**After any change to `apps/prototype/app-preview.html`, before ending the turn:**

```bash
npm run design      # python3 scripts/build-design-system.py --out design-system
```

If it reports `changed: ...`, push those cards - and only those - to the
project with `DesignSync`: `finalize_plan` (with `localDir` set to this repo's
`design-system/`), then `write_files` with a `localPath` per changed card.

`--check` exits non-zero when the bundle on disk is stale, so it also works as
a pre-commit guard.

A `PostToolUse` hook in `.claude/settings.json` does the rebuild automatically
and asks for the push. It only takes effect in sessions that started after the
settings file existed, so treat this instruction as the reliable path and the
hook as the convenience.

### Adding a component to the design system

Add an entry in `build()` in `scripts/build-design-system.py`: a `@dsCard`
group, a title, a note explaining *why* the component is the way it is (not
just what it looks like), the demo markup, and `R(".selector", ...)` listing the
class names whose real CSS the card should carry. Do not paste CSS into the
card. `R(...)` fails the build on a selector the app no longer has, and
`photo(...)` fails on a missing photograph - both used to degrade silently.

## Propose a design direction, don't just document the current one

Claude Design is the design surface, not a mirror of the code. Two groups live
there and they do different jobs:

- **Foundations / Components** - generated from the prototype, documents what
  the app does today. Never hand-edited.
- **Directions** - proposals. A more modern, more particular take on what is
  being built, for the client to choose from before it is implemented.

When building anything substantial, put a direction in front of the client
rather than only shipping the obvious version. Load the `frontend-design` skill
first and follow its two-pass process: a written plan (palette, type, layout,
principles) reviewed for genericness *before* any code.

Each Directions card carries the plan beside the mockup, because a direction
the client cannot reason about is just a picture. Say what the thesis is, where
the restraint is, and what you deliberately did not do.

**The bar.** The current build takes Airbnb's palette and Netflix's layout.
That is two references, not a point of view. A direction has to come from the
subject: newcomers to Calgary, trust as the actual currency, four languages
that must sit as equals. If a proposal would look the same for a food-delivery
app, it is not a direction yet.

Avoid the house style of generated design: cream backgrounds with a terracotta
accent, near-black with one acid accent, everything chopped into identical
rounded cards, an ALL-CAPS eyebrow above every heading, meta strings joined
with middle dots.

## Honesty rules this product is built on

These are not style preferences. Each one exists because the opposite shipped
once and had to be fixed.

- **Never claim live data without a live source.** The sheet once read
  "straight from this business's own calendar" over invented times. A tier is
  `connected` only when a feed actually answered; everything else says what it
  is.
- **The server's answer outranks the sample data.** A record marked
  `connected` with no feed configured resolves to `declared`, and the badge has
  to follow.
- **A time is a time on a date.** Bare clock labels let three "non-colliding"
  times sit on three different days while reading as one afternoon.
- **Motion may carry emphasis, never state.** With `prefers-reduced-motion`,
  the microphone's listening state was once pixel-identical to idle.
- **Hard constraints filter, soft ones score.** A filtered candidate is never
  scored back in, whatever it would have scored.

## Things that will bite you

- `apps/prototype/app-preview.html` is written as an artifact **body** - no
  `<!doctype>`, `<html>` or `<head>`. The artifact host supplies them. Served
  raw it gets no charset (Korean turns to mojibake) and no viewport meta (media
  queries never fire). `npm run prototype` wraps it; the server wraps it too,
  so `/app` is a complete document.
- Photographs in the prototype are base64 data URIs because the artifact CSP
  blocks every remote image origin - a linked image renders blank with no
  error. The React app uses the same photographs as real files in
  `apps/web/public/photos`.
- The prototype's photo CSS lives in a **late** `<style>` on purpose, so first
  paint lands on the gradient placeholders. Moving it into the head roughly
  doubles DOMContentLoaded.
- Text over a photograph needs the scrim measured, not eyeballed.
- `kill %1` does nothing here: each Bash call is a new shell with no job table.
  Record the PID and kill that.
- The preview tool caches `.claude/launch.json` from session start. After
  editing it, start servers directly instead of expecting the new names.
