# 0004 - Exact where it matters, eventual everywhere else

**Status:** Proposed

## Decision
| Data | Guarantee |
| --- | --- |
| Holds and bookings | Strong: single primary, exclusion constraint, version check on confirm |
| Payments | Strong: Stripe is the source of truth, reconciled by webhook |
| Availability shown while browsing | Eventual, up to 60 s, version-stamped |
| Events on users' own calendars | Eventual, retried until confirmed; status shown per calendar |
| Messages | Read-your-own-writes within a conversation |
| Search and ranking | Eventual |
| Personal interest profile | Never leaves the device |

## Why
Strong consistency everywhere is slow and expensive; eventual consistency
everywhere double-books people. The skill is choosing per piece of data. The
line is drawn at the moment something is committed on someone's behalf: before
it, a minute-old answer is fine; at it, only the live answer counts.

## Consequences
The confirm path never reads a cache. The UI shows freshness honestly
("updated 40 s ago") rather than implying everything is live.
