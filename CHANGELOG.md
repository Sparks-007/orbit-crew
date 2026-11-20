# Changelog

All notable changes to Orbit Crew are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### M1 independent audit — verification and hardening

### Added

- Persistent automated integration suite (`tests/`, vitest — 99 tests) covering password hashing, session lifecycle (revocation, expiry, sliding refresh), registration/login/logout, RBAC matrix, rank hierarchy, ownership transfer, cross-tenant isolation (404 no-leak semantics, forged membership IDs), forged-payload resistance, origin/CSRF enforcement, rate limiting and env validation. Runs against SQLite (`bun run test:sqlite`) and PostgreSQL 16 (`bun run test:pg`).
- `scripts/db-provider.mjs` — switches the Prisma datasource provider between SQLite (sandbox) and PostgreSQL (production target) in the single committed schema file.
- `scripts/test-postgres.mjs` — orchestrates the PostgreSQL test run and always restores the SQLite default.
- CI jobs: integration tests on SQLite, integration tests against a PostgreSQL 16 service container, Prisma schema validation, and a production build from a clean checkout.
- `src/instrumentation.ts` — fail-fast startup: invalid production configuration aborts the process at boot (exit code 1) instead of surfacing as a 500 on first secret use.

### Security

- Ownership transfer is now race-safe under PostgreSQL READ COMMITTED: the demotion step is a conditional update that only succeeds while the actor still holds OWNER, so concurrent transfers cannot produce two owners (verified by a dedicated concurrency test).
- Granting the ADMIN role is now OWNER-only, matching the documented RBAC matrix (previously an ADMIN could promote a MEMBER to ADMIN via the role-update endpoint).
- `Origin: null` is now rejected on mutating requests (sandboxed-iframe contexts a legitimate client never produces).
- The internal-host CSRF tolerance (sandbox preview gateway) is now disabled in production — mismatched external origins always fail closed there.
- Production additionally rejects an `AUTH_SECRET` copied verbatim from `.env.example` (placeholder values previously passed the length check).
- `next build` no longer ignores TypeScript errors (`typescript.ignoreBuildErrors` removed; `bun run typecheck` and the CI build both enforce it).
- Image optimization is disabled (`images.unoptimized`) — M1 ships no `next/image` usage, keeping the sharp decoder stack out of the production request path.

### Verified

- PostgreSQL 16.15 compatibility exercised end-to-end: schema validation, fresh-database initialization from the schema, unique constraints / indexes / CASCADE foreign keys verified on the server, and the full functional suite (registration, login, organizations, memberships, switching, role changes, ownership transfer, cross-tenant restrictions, concurrent transfers) — 99/99 passing on both SQLite and PostgreSQL.
- Production runtime verified over HTTP: fail-fast boot without secrets, health probe, register/session flows with HttpOnly + Secure cookies.

### Fixed — CI in clean environments

The first GitHub Actions run failed three of four jobs (`quality`, `tests-sqlite`, `build`; `tests-postgres` passed). Root cause: Bun skips `@prisma/client`'s `postinstall` generation unless the packages are trusted, so clean checkouts had no generated Prisma Client. All fixes verified locally from a wiped `node_modules`, with 99/99 tests passing on SQLite and PostgreSQL 16.

- `trustedDependencies` declared for `@prisma/client` and `@prisma/engines` (`package.json`, `bun.lock`), so a clean `bun install --frozen-lockfile` generates the Prisma Client.
- Explicit `prisma generate` added to the CI `quality` job (before lint/typecheck) and `build` job (before `next build`, which type-checks since `ignoreBuildErrors` was removed).
- `test:sqlite` now selects the SQLite provider (`scripts/db-provider.mjs sqlite`) before applying the schema and generates the SQLite client explicitly before running vitest — provider switching and client generation remain correctly ordered.
- `prisma validate` in the `quality` job now receives a SQLite placeholder `DATABASE_URL` (`file:./dev.db`) — the CLI requires the variable to be defined even though validation never connects, and clean CI checkouts have no `.env`.
- `public/*.zip` added to `.gitignore` so delivered patch archives can never be committed.

## [0.1.0] — 2026-11-17

### M1 — Project Foundation

### Added

- Password authentication: scrypt (N=16384, r=8, p=1) with per-user salt and a versioned hash format; opaque session tokens (32 random bytes, base64url) stored as HMAC-SHA256(AUTH_SECRET, token); httpOnly, SameSite=Lax, Secure-in-production cookies; server-side revocation; 30-day TTL with sliding refresh past half-life.
- Organizations with slug validation and a reserved-word guard; the creator becomes OWNER inside a single transaction.
- Memberships with the OWNER/ADMIN/MEMBER RBAC matrix, rank hierarchy (actors may only modify strictly lower-ranked members), single-owner invariant, and transactional ownership transfer.
- Multi-tenant authorization guards: identity resolved server-side from the session cookie only, membership-scoped org context, and 404 (not 403) responses for foreign-tenant resources to prevent existence leaks.
- REST API surface: `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/session`, `/api/orgs`, `/api/orgs/[slug]`, `/api/orgs/[slug]/members`, `/api/orgs/[slug]/members/[membershipId]`, `/api/health` — Zod-validated bodies and a consistent typed error envelope.
- Rate limiting (in-memory fixed window): register 5/hour per IP; login 20/10 min per IP and 10/10 min per email; organization creation 10/hour per user; member addition 30/hour per user.
- Environment validation: `AUTH_SECRET` (min 32 chars) fail-fast in production; clearly-labelled insecure fallback with warning in development.
- Prisma schema (User, Session, Organization, Membership) and the `db:push` workflow on SQLite.
- Health endpoint with a database connectivity probe (200 ok / 503 degraded).
- UI application: landing page, register/login, organization onboarding, org switcher, overview dashboard, member management with role-based affordances, settings with danger zone, dark mode — a single-route client-side shell over the typed API client, with Sonner toasts and next-themes dark mode.
- Infrastructure artifacts: multi-stage Bun Dockerfile (standalone output, non-root, healthcheck), docker-compose stack with PostgreSQL 16, deployment notes, runtime-service placeholder, and CI (lint + typecheck).
- Documentation set: architecture overview, database guide, ADR-001 (sandbox monorepo layout), ADR-003 (SQLite in sandbox), security review, contributing and security policies.

### Security

- Same-origin enforcement on every mutating request (Origin vs Host/APP_URL), layered on SameSite=Lax cookies.
- Generic authentication errors and timing-equalized login (dummy scrypt verification for unknown emails) to prevent account enumeration.
- Reserved organization slugs protecting platform and well-known routes.
- Tenant-scoped queries on every server-side lookup; client-submitted organization IDs are never trusted.
- No secrets committed: `.env` is gitignored; only `.env.example` is tracked.
