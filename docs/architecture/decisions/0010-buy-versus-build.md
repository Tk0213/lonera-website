# 0010 - Buy the commodity, build the core

**Status:** Proposed

## Decision
Buy: authentication (a managed identity provider with passwordless email and
phone sign-in, and Sign in with Apple wherever other social logins are offered,
as the App Store requires); payments (Stripe Connect - card data never touches
Lonera's servers); ID verification; email, SMS and push delivery.

Build: scheduling, matching and ranking, availability tiers, the standby queue,
trust records, and the bilingual experience.

## Why
A two-person team should spend its engineering on what no vendor sells.
Authentication and payments are solved problems with severe failure modes;
getting them subtly wrong costs more than the vendor ever will. Scheduling,
matching and trust for Calgary's newcomer communities is what Lonera is.

## Consequences
Vendor costs and lock-in, managed by keeping each behind a module interface.
Each vendor outside Canada joins the disclosure list (0003).
