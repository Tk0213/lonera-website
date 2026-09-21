# 0005 - Every side effect leaves through a transactional outbox

**Status:** Proposed

## Decision
When a request changes state and something else must happen as a result - a
calendar event, a push, an email, a live update - the change and an `outbox`
row describing the side effect are written in one transaction. Workers read the
outbox, perform the side effect with a stable idempotency key, and mark it done.
Delivery is at-least-once; every consumer is idempotent.

## Why
The alternative - commit, then call Google - fails in the gap between the two.
A crash after the commit loses the calendar event; calling Google first and then
failing to commit creates an event for a booking that does not exist. The
outbox closes that gap by making "the booking happened" and "tell the calendar"
the same fact.

This is the end-to-end argument (Saltzer, Reed and Clark, MIT, 1984) applied:
reliable delivery cannot be guaranteed by the network in the middle, only by the
endpoints. So retries are always safe - Google event ids are derived from the
booking id, emails carry a UID and SEQUENCE, pushes carry a dedupe key.
At-least-once delivery to idempotent consumers is effectively exactly-once.

## Consequences
A Google outage delays a calendar event rather than failing a booking. Side
effects are observable and replayable. The worker needs dead-letter handling
and alerting when a row keeps failing.
