# Lonera

A bilingual (English / Korean) local-services marketplace for Calgary's newcomer
communities — Korean, Filipino, South Asian and Chinese.

Founders: TK Lim, Connor Kim.

Everything here is a prototype. The businesses, reviews, jobs, listings and
statistics are fictional demo data; nothing connects to a real backend.

## What is in the repo

| File | What it is |
| --- | --- |
| `index.html` | The marketing site. Bilingual, accessible, older-user first. |
| `dashboard.html` | The provider-facing dashboard for the site. |
| `app-preview.html` | The mobile app prototype. The main piece of work. |
| `server.js` | Express static server, so the three pages can be served locally. |
| `graphify-out/` | Knowledge-graph output from `/graphify` over this codebase. |

## Running it

```bash
npm install
npm start
```

Then open <http://localhost:3000> for the site, `/dashboard` for the provider
view, and `/app-preview.html` for the app prototype.

`app-preview.html` is written as an artifact body — no `<!doctype>`, `<html>`
or `<head>` of its own, because the artifact host supplies them. Served on its
own by a plain static server it will render without a charset (Korean turns to
mojibake) and without a viewport meta (media queries never fire). That is a
harness gap, not a bug in the file. Wrap it if you need to open it directly:

```bash
python3 -c "
import io; b=io.open('app-preview.html',encoding='utf-8').read()
io.open('app-harness.html','w',encoding='utf-8').write(
  '<!doctype html><html><head><meta charset=utf8>'
  '<meta name=viewport content=\"width=device-width,initial-scale=1\">'
  '</head><body>\n'+b+'\n</body></html>')"
```

`app-harness.html` is gitignored.

## The app prototype

One self-contained HTML file. No framework, no build step, no network calls.
State lives in memory; there is no persistence between reloads.

**Layout.** Every control sits in the bottom third, reachable one-handed. The
toolbar is a floating island — inset from the edges, rounded, translucent with
a backdrop blur — and content scrolls underneath it.

**Six tabs.** Home, Browse, Community, Saved, Inbox, You. A seventh view, the
business dashboard, is reached from You rather than the tab bar.

**Voice search.** The mic opens a full-screen search that starts listening
immediately and transcribes as you speak. Enter ranks results left to right.
The parser reads four facets — service, language, day, action — so
*"find a korean doctor near me and make an appointment with anyone who is
available tomorrow"* resolves to the Korean-speaking clinic with tomorrow
preselected. A named service is a requirement, not a hint: asking for a
dentist never returns a rental just because it shares a language.

**Messages.** Apple-style conversations: grouped bubbles with tails, delivery
stamps, an auto-growing compose bar, a typing indicator and a reply.

**Notification island.** Floats above the search bar rather than at the top of
the screen, so notifications stay in the same thumb zone as everything else.

**Verification.** One badge vocabulary shared by people and businesses — ID
verified, Business verified, Licensed, Insured, Payment protected, New member,
Top rated — plus your own verification status and what is still outstanding.

**Business dashboard.** Weekly profile visits as a hero figure with a delta,
three stat tiles, a seven-day column chart, the queue of people who requested
a job with accept/decline, and invoices with status.

**Community.** Neighbour-run groups — soccer, running, hiking, newcomers
coffee, Korean church, Filipino home cooks — with join state and a Q&A board.

**Scrolling.** Rubber-band overscroll at both ends, implemented rather than
left to the browser so Android behaves like iOS. Pulling past the top
dissolves the colour there into page white and springs back.

## Images

Thirty photographs from [Pexels](https://www.pexels.com), embedded as base64
data URIs in the stylesheet.

They are embedded rather than linked because the artifact host's CSP blocks
every remote image origin — an `<img src="https://…">` renders blank with no
error. The photo CSS is loaded in a late `<style>` so first paint lands on the
gradient placeholders underneath; this keeps DOMContentLoaded around 90ms
despite the page being roughly 1.9MB.

Pexels' licence permits commercial and non-commercial use with no attribution
required. Two photographs were rejected during selection and replaced: one
grocery shot was wall-to-wall third-party brand packaging, and one clinic shot
was a full-frontal portrait of an identifiable person, which should not be the
face of a fictional business.

## Design decisions worth knowing

**Palette.** White ground with an Airbnb-style rose accent. `--brand` for
fills and large glyphs, `--brand-ink` (5.4:1) for small text, `--brand-btn`
for buttons where white text needs 4.6:1.

**Contrast.** Body text is 15.9:1, secondary 7.0:1. The hero scrim was tuned
twice by measurement: at one point the headline's top edge sat at scrim alpha
0.155 — dark text on bare photograph. It now sits on 0.93 white or better
regardless of which photo is behind it.

**Touch targets.** 52px standard, nothing below the 24px WCAG minimum. The
audience skews older, so the floor is deliberately generous.

**Motion.** One press scale (0.96) everywhere, every transition names its
easing, and no state change is carried by motion alone. The listening state,
for instance, changes fill, adds a ring, swaps the glyph and updates the
label — so it survives `prefers-reduced-motion` switching the pulse off.

**Bilingual.** All copy runs through a translation table keyed `en` / `ko`.
Headings show one language at a time and follow the Language setting; your own
typed messages are never translated.

## Research behind the later changes

Some of the app's behaviour comes from published benchmark data rather than
taste — chiefly [Baymard's mobile app UX benchmark](https://baymard.com/blog/mobile-app-ux-trends)
of 30 leading commerce apps.

- A submit control sits beside the search field. 90% of benchmarked apps have none.
- The query survives the search so it can be refined. 33% discard it.
- Autocomplete matches categories and businesses, deduped and capped at five.
- Listings carry same-category cross-sells. 31% of apps have none, while 76% of
  users look at them and 59% specifically to check for a better option. Where a
  category has no second provider the section is retitled honestly rather than
  padded with unrelated businesses.
- Every business carries two written reviews. A star average with nothing
  behind it is the thinnest trust signal a marketplace can have.

## Known gaps

- **Speech recognition is untested against a real microphone.** The Web Speech
  API wiring is standard and every tap and type path is verified, but the
  development browser blocked mic access throughout, so recognition itself has
  never run.
- No backend, no auth, no persistence. Reloading resets everything.
- Not published to any app store. `app-preview.html` is a web prototype of a
  native app, not a native app.

## Licence

Private prototype. Not licensed for redistribution.
