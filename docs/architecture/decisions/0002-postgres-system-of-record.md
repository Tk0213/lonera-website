# 0002 - PostgreSQL is the system of record

**Status:** Proposed

## Decision
One managed PostgreSQL cluster holds all durable state. It also serves as the
job queue (via `FOR UPDATE SKIP LOCKED`, or pg-boss) and the change-notification
bus (`LISTEN/NOTIFY`) until measurements say otherwise. No second datastore -
no Redis, no Kafka, no document store - until one is justified by a number.

## Why
The rule that matters most is enforced by the database itself: an exclusion
constraint over `(tutor_id, time range)` makes an overlapping booking
impossible to insert, however many servers race (see `db/schema.sql`). No
application-level lock is as dependable as that, and no other open-source
database offers it as directly.

Every added datastore is another thing that can disagree with the first one.
Postgres doing the queue and the notifications means a booking, the jobs it
creates and the signal that it happened all commit or roll back together.

## Consequences
Postgres becomes the bottleneck to watch, and the one to protect: point-in-time
recovery on, a read replica for reporting, connection pooling from day one.

## Revisit when
Queue depth or NOTIFY volume measurably loads the primary, rate limiting needs
state shared across many instances, or search quality demands a dedicated index
(Korean text is the likely trigger - see 0007).
