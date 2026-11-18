# ADR-003: SQLite in the sandbox, PostgreSQL in production

- **Status:** Accepted
- **Date:** 2026-11-17
- **Scope:** Database provider for development

## Context

The master spec mandates PostgreSQL as the production database. The current sandbox, however, provides only SQLite through its preconfigured Prisma toolchain: the database file lives under `db/` (gitignored), and the supported schema workflow is `bun run db:push`. No PostgreSQL server is available in this environment. Building M1 against an unavailable provider would block shipping and verifying the foundation now.

## Decision

1. Develop M1 on SQLite with a **provider-portable schema**: no PostgreSQL-only constructs; the membership role is a validated string rather than a native enum; timestamps use Prisma-managed defaults.
2. Keep production PostgreSQL as the declared target: `infra/docker/docker-compose.yml` ships a PostgreSQL 16 service, and the provider switch steps are documented in `docs/architecture/database.md`.
3. Switch the datasource provider via those documented steps before any Batch 2 work that needs PostgreSQL features.

## Consequences

- (+) M1 ships and verifies now, on the toolchain the sandbox actually provides.
- (+) The schema ports to PostgreSQL with a provider change plus a migrate adoption — no model rewrite.
- (-) No PostgreSQL enums, partial indexes or `timestamptz` defaults yet; these remain listed as post-switch upgrades.
- (-) SQLite's concurrency limits are acknowledged: it is a single-writer database, adequate for sandbox development, not for production traffic.

## Revisit trigger

M2 (encrypted BYOK credentials and transactional usage tracking at scale), or the first multi-instance deployment — whichever comes first.

## 2026-11-18 audit verification

The "schema ports cleanly" claim was put to the test: the full integration
suite was executed against **PostgreSQL 16.15** (schema validation, fresh
database initialization via `db push`, server-side verification of every
unique index / FK cascade, and 99/99 functional tests including the
concurrent ownership-transfer case under READ COMMITTED). The provider
switch is automated by `scripts/db-provider.mjs` and exercised in CI
(`tests-postgres` job with a `postgres:16-alpine` service). Details in
`docs/architecture/database.md`.
