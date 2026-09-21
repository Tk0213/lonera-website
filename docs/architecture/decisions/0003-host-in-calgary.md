# 0003 - Host in Canada: AWS Canada West (Calgary)

**Status:** Proposed

## Decision
Production runs in AWS `ca-west-1` (Calgary): containers on ECS Fargate,
PostgreSQL on Aurora, uploads in S3, secrets in Secrets Manager with KMS.
Backups replicate to `ca-central-1` (Montreal). Confirm each service is offered
in `ca-west-1` at build time; Montreal is the fallback.

## Why
Lonera serves newcomers - people whose immigration status, passports and home
addresses pass through this system. Keeping that data in Canada is the honest
default, and Calgary is where the users are.

Alberta's PIPA (s. 13.1) requires that people be told when a service provider
outside Canada handles their personal information, and that the privacy policy
name the countries involved and the purposes. Hosting in Canada keeps the core
of the data out of that rule. It does not remove it: the AI providers, Stripe,
the ID-verification vendor and push services are outside Canada and must be
disclosed.

## Consequences
Slightly fewer services and slightly higher prices than the largest US regions.
Every foreign processor goes on a list that the privacy policy publishes.

## Revisit when
A needed service is not offered in Canada, or a partner requires a specific
provider.
