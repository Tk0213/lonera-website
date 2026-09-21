# 0009 - Trust is evidence with an expiry date

**Status:** Proposed

## Decision
A badge is never a stored boolean. It is derived from a verification record:
what was checked, against what source, by whom, when, and when it expires.
- **Identity:** a vendor check that accepts the documents newcomers actually
  hold - foreign passports, PR cards, work permits - not only Canadian licences.
- **Immigration consultants:** licence number checked against the public
  register of the College of Immigration and Citizenship Consultants; lawyers
  against the Law Society of Alberta. Manual review first, automated later.
- **Insurance and trade licences:** uploaded document plus expiry date.
- **Reviews:** only from someone with a completed booking with that provider.

## Why
Trust is the product. Today's badges are decorative - nothing checks them - and
a marketplace for people who cannot yet judge local credentials must not
display a credential it has not verified. Unlicensed immigration advice is
illegal in Canada; listing it is a liability. Reviews tied to completed
bookings cannot be bought in bulk.

## Consequences
Every badge can answer "how do you know?". Expired evidence removes the badge
automatically. Onboarding a provider takes longer, deliberately.
