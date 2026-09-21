# 0008 - AI behind a gateway

**Status:** Proposed

## Decision
All model calls go through one module that:
- accepts output only as structured data validated against fixed enums, so a
  model cannot invent a service category or a subject;
- keeps the rule-based parser as the floor, so the product works with no model;
- sends the minimum: no names, phone numbers or addresses;
- caps spend per user and per day, and rate-limits the endpoint;
- logs provider failures without the user's words or the key;
- pins prompt versions and runs the brief's worked examples as a regression set.

## Why
Model output is data, never instruction. The providers are outside Canada, so
PIPA disclosure applies (0003), and users describing an immigration situation
are sharing exactly what the law protects. Minimising what is sent reduces both
the risk and the disclosure.

## Consequences
The AI feature degrades gracefully instead of failing. Swapping OpenAI for
Gemini, or for a model hosted in Canada, is a configuration change.
