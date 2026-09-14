# @lonera/core

Everything the web app, the native app and the server all need to agree on.

The rule for this package is what keeps it useful: **no Node built-ins, no DOM,
no network.** React Native has no `node:dns` and no `document`; a browser has no
`node:net`. Anything that reaches for those belongs in `apps/server`, which is
why the SSRF guard, the iCal fetcher, the Places adapter and the model providers
are not here.

It exists because the same rules were previously written twice — once in
`app-preview.html` for the UI and once in `lib/` for the server — and two copies
of a fairness rule is a bug waiting to happen. `test/ranking.test.js` and
`test/waitlist-app.test.js` were written purely to catch that drift. Those tests
stop being necessary once both sides import from here.

| Module | What it decides |
| --- | --- |
| `tiers.js` | Whether availability may be called live, and when a feed is too stale to count |
| `slots.js` | Slot arithmetic and the day model — a time is a time *on a date* |
| `waitlist.js` | Who gets a cancelled slot, and in what order |
| `intent.js` | What a sentence is asking for, enum-locked |
| `ranking.js` | Feed order, including the rule that language never ranks housing |
| `businesses.js` | The stand-in for the provider table |
| `i18n.js` | Both languages, and the only `t()` |
