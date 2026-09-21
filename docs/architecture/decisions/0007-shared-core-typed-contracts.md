# 0007 - One shared core; typed contracts at the edges

**Status:** Proposed

## Decision
Every rule two or more apps must agree on lives once, in `packages/core`, with
no Node built-ins, no DOM and no network. Request and response shapes are
defined once as schemas (zod) in a `packages/contracts` package and validated
on both sides of every call. The codebase moves to TypeScript incrementally,
`packages/core` first.

## Why
The rule was learned the hard way here: the housing-ranking rule and the
standby order were once written twice and needed dedicated tests to catch the
copies drifting. A schema checked at runtime on the server also closes a class
of bugs types alone cannot: a client that sends the wrong shape is refused at
the door instead of halfway through a booking.

## Consequences
A build step for the server once TypeScript lands. Search stays in Postgres to
start; Korean needs checking, because Postgres' built-in full-text search does
not segment Korean words. If trigram matching proves weak on real queries, move
search to a dedicated index with a Korean analyzer.
