# 0001 - One deployable application, divided into modules

**Status:** Proposed

## Context
Two founders, no users yet. The hardest correctness problem - a hold, a live
check and a confirmation that must never let two people into one slot - spans
several concerns and has to commit in one transaction.

## Decision
`apps/server` becomes a modular monolith: one deployable, one database, divided
into modules under `src/modules/` - identity, catalog, availability,
reservations, calendar, messaging, trust, payments, notifications, ai. A module
exposes a small interface and owns its tables; other modules call the interface,
never the tables. Workers run the same code in a separate process.

## Why
Microservices solve organisational scaling - many teams shipping independently -
at the price of network failure between every pair of services, distributed
transactions, and an operations burden. Lonera has none of the first problem and
cannot afford the second. Parnas (1972) is the useful idea here: decompose by
what is likely to change and hide it behind an interface. That gives most of the
benefit of services without the network in the middle. Conway's law says the
system will mirror the team; the team is two people.

## Consequences
One thing to deploy, monitor and back up. A reservation and its outbox rows
commit together. Discipline is required: nothing stops a module reading another
module's tables except review and, later, lint rules.

## Revisit when
A module needs to scale or deploy independently (the AI worker's cost, likely
first), a compliance boundary demands isolation (payments), or the team grows
past roughly eight engineers.
