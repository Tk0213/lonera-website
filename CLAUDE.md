# Lonera

Bilingual (English / Korean) local-services marketplace for Calgary's newcomer
communities. See README.md for what the repo contains and how to run it.

## Keep the design system in step with the app

The Claude Design project **Lonera Design System**
(`6a27b096-300e-4a43-ad92-73bfa8e65a69`) holds one preview card per component.
Those cards are **generated from `app-preview.html`**, never hand-written -
`scripts/build-design-system.py` pulls the real rules out of the app's own
stylesheet, so a card cannot drift from what the app does.

**After any change to `app-preview.html`, before ending the turn:**

```bash
python3 scripts/build-design-system.py --out design-system
```

If it reports `changed: ...`, push those cards - and only those - to the project
with `DesignSync`: `finalize_plan` (with `localDir` set to this repo's
`design-system/`), then `write_files` with a `localPath` per changed card.

`--check` exits non-zero when the bundle on disk is stale, so it also works as a
pre-commit guard.

A `PostToolUse` hook in `.claude/settings.json` does the rebuild automatically
and asks for the push. It only takes effect in sessions that started after the
settings file existed, so treat this instruction as the reliable path and the
hook as the convenience.

### Adding a component to the design system

Add an entry in `build()` in `scripts/build-design-system.py`: a `@dsCard`
group, a title, a note explaining *why* the component is the way it is (not just
what it looks like), the demo markup, and `R(".selector", ...)` listing the class
names whose real CSS the card should carry. Do not paste CSS into the card.

## Propose a design direction, don't just document the current one

Claude Design is the design surface, not a mirror of the code. Two groups live there
and they do different jobs:

- **Foundations / Components** - generated from `app-preview.html`, documents what the
  app does today. Never hand-edited.
- **Directions** - proposals. A more modern, more particular take on what is being
  built, for the client to choose from before it is implemented.

When building anything substantial, put a direction in front of the client rather than
only shipping the obvious version. Load the `frontend-design` skill first and follow its
two-pass process: a written plan (palette, type, layout, principles) reviewed for
genericness *before* any code.

Each Directions card carries the plan beside the mockup, because a direction the client
cannot reason about is just a picture. Say what the thesis is, where the restraint is,
and what you deliberately did not do.

**The bar.** The current build takes Airbnb's palette and Netflix's layout. That is two
references, not a point of view. A direction has to come from the subject: newcomers to
Calgary, trust as the actual currency, four languages that must sit as equals. If a
proposal would look the same for a food-delivery app, it is not a direction yet.

Avoid the house style of generated design: cream backgrounds with a terracotta accent,
near-black with one acid accent, everything chopped into identical rounded cards, an
ALL-CAPS eyebrow above every heading, meta strings joined with middle dots.

## Things that will bite you

- `app-preview.html` is written as an artifact **body** - no `<!doctype>`,
  `<html>` or `<head>`. The artifact host supplies them. Served by a plain static
  server it gets no charset (Korean turns to mojibake) and no viewport meta
  (media queries never fire). Wrap it first; see README.md.
- Photographs are embedded as base64 data URIs because the artifact CSP blocks
  every remote image origin - a linked image renders blank with no error.
- The photo CSS lives in a **late** `<style>` on purpose, so first paint lands on
  the gradient placeholders. Moving it into the head roughly doubles
  DOMContentLoaded.
- Text over a photograph needs the scrim measured, not eyeballed. The hero
  headline once sat at scrim alpha 0.155 - dark text on bare photograph - and
  read fine only because that particular photo was pale.
