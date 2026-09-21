# 0006 - Real time: server-sent events on LISTEN/NOTIFY

**Status:** Proposed

## Decision
Open screens receive changes over server-sent events. Each API instance
LISTENs on Postgres channels; a committed change NOTIFYs with ids only, and the
instance fans out to its connected clients. Every event carries a version
number; a client that sees a gap refetches. A backgrounded mobile app is reached
by push notification instead.

## Why
Updates flow one way, server to client, so WebSockets' two-way channel buys
nothing and costs sticky sessions and custom reconnection. SSE is plain HTTP,
reconnects on its own and resumes from the last event id. NOTIFY is delivered
only on commit, so a client can never be told about a booking that later rolled
back. Version numbers make silence detectable: a quiet connection is not proof
that nothing changed.

## Consequences
NOTIFY payloads are small, so events carry ids and clients fetch detail. Beyond
a few thousand concurrent connections per instance, revisit.
