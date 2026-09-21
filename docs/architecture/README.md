# Lonera platform architecture

The system Lonera should grow into, and the reasons for each part of it.
The full write-up, with diagrams, is published as **Lonera Platform
Architecture**; this folder is the version the code is held to.

## In one paragraph

One application, divided into clear modules, on one PostgreSQL database hosted
in Calgary. The database enforces the rule that matters most - no two people in
one slot - and every side effect (calendar events, push notifications, email)
leaves through an outbox written in the same transaction as the change that
caused it. Commodity problems - identity, payments, ID checks - are bought.
The problems that are Lonera - scheduling, matching, trust - are built, in
`packages/core`, shared by the web app, the mobile app and the server.

## Decisions

Each record says what was decided, why, what it costs, and what would make us
revisit it. They are **Proposed** until the founders accept them.

| # | Decision |
| --- | --- |
| [0001](decisions/0001-modular-monolith.md) | One deployable application, divided into modules - not microservices |
| [0002](decisions/0002-postgres-system-of-record.md) | PostgreSQL is the system of record, and the job queue until proven otherwise |
| [0003](decisions/0003-host-in-calgary.md) | Host in Canada: AWS Canada West (Calgary) |
| [0004](decisions/0004-consistency-model.md) | Exact where money and bookings are involved, eventual everywhere else |
| [0005](decisions/0005-transactional-outbox.md) | Every side effect leaves through a transactional outbox |
| [0006](decisions/0006-realtime.md) | Server-sent events on Postgres LISTEN/NOTIFY; push for backgrounded apps |
| [0007](decisions/0007-shared-core-typed-contracts.md) | One shared core; typed contracts at the edges |
| [0008](decisions/0008-ai-gateway.md) | AI behind a gateway: enum-validated, minimised, disclosed, capped |
| [0009](decisions/0009-trust-is-evidence.md) | Trust is evidence with an expiry date, not a boolean |
| [0010](decisions/0010-buy-versus-build.md) | Buy identity, payments and ID checks; build scheduling, matching, trust |
| [0011](decisions/0011-expo-mobile.md) | One React Native (Expo) app for iOS and Android |

## Related

- `db/schema.sql` - the reservations, outbox and calendar tables (written, not yet run)
- The **Lonera Booking Engine** page - the scheduling subsystem in detail
