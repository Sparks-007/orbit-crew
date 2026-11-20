# Orbit Crew

**Your AI workforce. Working together.**

Orbit Crew is a multi-tenant SaaS platform for creating, managing and working with AI employees. Organizations register, invite teammates, and delegate work to AI employees that execute tasks on their behalf. V1 delivers individual AI employees; the AI Coordinator and multi-agent teams arrive in V2.

> **This repository is being prepared for public release.** The M1 foundation is complete, independently audited and covered by a persistent automated test suite. It is **not production-ready** — see [Status](#status) and [Roadmap](#roadmap-summary).

## Status

Phase 1 — V1 Core AI Workforce · Batch 1 · Milestone **M1 — Project Foundation** (v0.1.0, 2026-11-17). M1 has since passed an independent verification, security-hardening and readiness audit (2026-11-18), followed by CI fixes so the full pipeline runs from a clean checkout. Full plan: [ROADMAP.md](ROADMAP.md). Verified history: [CHANGELOG.md](CHANGELOG.md).

M1 delivers the secure control-plane foundation, as implemented and verified in this repository:

- Password authentication: scrypt hashing (per-user salt), opaque server-side sessions with revocation and sliding expiry.
- Organizations and memberships: validated slugs with a reserved-word guard, one membership per user per organization.
- OWNER / ADMIN / MEMBER role-based permissions (`src/lib/contracts/rbac.ts`).
- Multi-tenant authorization guards: identity resolved server-side from the session cookie; foreign-tenant resources return 404, never 403.
- REST API surface (auth, orgs, members, health) with Zod-validated bodies and a typed error envelope.
- Rate limiting on register, login, organization creation and member addition.
- Environment validation: `AUTH_SECRET` enforced, fail-fast in production.
- Prisma schema (User, Session, Organization, Membership) with a `db:push` workflow.
- Health endpoint with a database connectivity probe.
- Client application: landing, register/login, onboarding, org switcher, overview, member management, settings with danger zone, dark mode theming — a single-route client-side shell backed by the typed same-origin API client.

Nothing beyond M1 is implemented. Features listed in the roadmap are plans, not shipped functionality.

## Architecture overview

Orbit Crew is planned as three layers; M1 implements the first one. Details and the RBAC/API tables live in [docs/architecture/overview.md](docs/architecture/overview.md).

| Layer | Purpose | Status |
| --- | --- | --- |
| **Control Plane** | This Next.js application: accounts, organizations, memberships, RBAC, REST API, UI shell | Implemented in M1 |
| **Orbit Runtime** | Execution layer for AI employees: model gateway (M2), task lifecycle and streaming (M4), memory/files (M5), tools (M6) | Planned — `services/runtime/` is a documented placeholder |
| **Execution Layer** | Isolated browser environments, workspace containers, egress control for safe compute (M6) | Planned |

Data model (M1): `User`, `Session`, `Organization`, `Membership` — see [docs/architecture/database.md](docs/architecture/database.md) for constraints and the PostgreSQL path.

## Tech stack

| Layer | Technology | Version |
| --- | --- | --- |
| Framework | Next.js (App Router, standalone output) | 16.1 |
| UI | React | 19 |
| Language | TypeScript | 5 |
| Styling | Tailwind CSS + shadcn/ui (Radix primitives) | 4 |
| ORM / database | Prisma — SQLite in this dev sandbox; PostgreSQL is the production target | 6.x (`^6.11`) |
| Validation | Zod | 4 |
| Runtime / package manager | Bun | 1.x |

## Installation and local development

Prerequisites: [Bun](https://bun.sh) 1.x.

```bash
bun install
cp .env.example .env      # set AUTH_SECRET: openssl rand -base64 32
bun run db:push           # create the SQLite database from prisma/schema.prisma
bun run dev               # http://localhost:3000
```

| Script | Purpose |
| --- | --- |
| `bun run dev` | Development server on :3000 |
| `bun run lint` | ESLint |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run test` | Integration suite on a throwaway SQLite database (alias for `test:sqlite`) |
| `bun run test:sqlite` | The SQLite integration run explicitly |
| `bun run test:pg` | Same suite against PostgreSQL 16 (`PG_TEST_URL=postgres://…`) |
| `bun run db:push` | Push `prisma/schema.prisma` to the database |
| `bun run db:generate` | Generate the Prisma client |
| `bun run db:migrate` | Create/apply a development migration |
| `bun run db:reset` | Reset the database |
| `bun run db:provider` | Print or switch the datasource provider (`node scripts/db-provider.mjs`) |

The integration suite (`tests/`) covers authentication, sessions, RBAC,
cross-tenant isolation, origin/CSRF enforcement, rate limiting and the
single-owner invariant — 99 tests, executed against SQLite locally and against
PostgreSQL 16 in CI. Note that `bun install` requires `@prisma/client` and
`@prisma/engines` to run their postinstall scripts — they are declared in
`trustedDependencies` in `package.json`, which Bun honors automatically.

## Environment setup

Copy `.env.example` to `.env` and fill in real values. Never commit `.env`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Prisma datasource. SQLite file in the sandbox (`file:…/db/custom.db`); PostgreSQL connection string in production. |
| `AUTH_SECRET` | Yes | HMAC key for session tokens at rest; minimum 32 characters (`openssl rand -base64 32`). Production startup fails fast when missing or left as the placeholder. |
| `APP_URL` | Optional (dev) | Canonical public URL; participates in the same-origin CSRF check behind proxies/gateways. |

## Docker setup

Artifacts live in [infra/docker](infra/docker); deployment notes and a pre-deploy checklist in [infra/deployment/README.md](infra/deployment/README.md).

- `infra/docker/Dockerfile` — multi-stage Bun image: deps → build (`prisma generate` + `next build`, standalone output) → non-root runner (`USER orbit`) with a `/api/health` healthcheck.
- `infra/docker/docker-compose.yml` — production-parity stack: the web service plus PostgreSQL 16 (`postgres:16-alpine`, named volume, `pg_isready` healthcheck), wired via `postgres://orbit:orbit@db:5432/orbit_crew`.

```bash
docker compose -f infra/docker/docker-compose.yml up --build
```

**Important caveats (honest limits, also stated in the deployment notes):**

- The committed schema targets **SQLite**. Complete the PostgreSQL provider switch ([docs/architecture/database.md](docs/architecture/database.md)) before relying on the compose stack for real data.
- No migrations exist yet (sandbox uses `db:push`); initialize a fresh database with `prisma db push` until `prisma migrate` is adopted.
- Change the compose database credentials (`orbit`/`orbit`) for any real deployment; inject `AUTH_SECRET` from a secret manager; terminate TLS at the edge.

This is a local/parity setup, not a managed-platform deployment story (no Vercel/Fly/Render configs, no Kubernetes manifests yet).

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request with four jobs:

| Job | What it does |
| --- | --- |
| `quality` | Install → `prisma generate` → lint → typecheck → `prisma validate` (SQLite placeholder `DATABASE_URL`) |
| `tests-sqlite` | Install → full integration suite on a fresh SQLite database |
| `tests-postgres` | Install → same suite against a `postgres:16-alpine` service container (provider switch + client regeneration automated by `scripts/test-postgres.mjs`) |
| `build` | Install → `prisma generate` → production build from a clean checkout with placeholder env values |

A green pipeline from a clean checkout is a release gate for every batch.

## Roadmap summary

- **Phase 1 — V1 Core AI Workforce (M1–M7):** M1 shipped and audited; M2–M7 planned (model gateway/BYOK, AI employees, task execution, memory/files, tools, approvals/launch).
- **Phase 2 — V2 Collaborative AI Workforce (M8–M13):** planned coordinator, teams and multi-agent delegation.
- **Phase 3 — V3 AI Workforce OS (M14–M18):** future marketplace, integrations, automation, billing, enterprise.

Full detail and per-milestone status: [ROADMAP.md](ROADMAP.md).

## Community edition direction

Orbit Crew is intended to grow an open, self-hostable community edition built on this repository's control-plane foundation, alongside options for hosted and commercially supported offerings. **The licensing and edition split is not finalized** — no LICENSE file exists yet, and terms will be published before any public release. Until then, all rights are reserved and contributions are governed by [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

Security is a primary M1 deliverable: scrypt password hashing, HMAC-hashed session tokens, httpOnly/SameSite cookies, membership-scoped authorization with a strict RBAC matrix, 404 (not 403) responses for foreign-tenant resources, same-origin enforcement for mutations, and fail-fast environment validation. See [docs/security/SECURITY-REVIEW-M1.md](docs/security/SECURITY-REVIEW-M1.md), [SECURITY.md](SECURITY.md), and [docs/architecture/overview.md](docs/architecture/overview.md).

## Contributing

Contributions are welcome once the public release lands. Development setup, branch/commit conventions, testing requirements and the PR security checklist live in [CONTRIBUTING.md](CONTRIBUTING.md). Security issues go through the private process in [SECURITY.md](SECURITY.md) — never public issues. Milestone discipline applies: implement only the work approved for the current batch.

## Repository structure

```
.
├── .github/workflows/      # CI (quality, tests-sqlite, tests-postgres, build)
├── src/
│   ├── app/                # Next.js App Router: UI entry + API routes (src/app/api)
│   ├── components/         # shadcn/ui primitives and app components
│   └── lib/
│       ├── contracts/      # Zod schemas + shared types (api.ts, rbac.ts)
│       ├── auth/           # password hashing, sessions, services, server guards
│       ├── api/            # route pipeline: errors, handler, request, rate limit
│       ├── orgs/           # organization + membership domain services
│       ├── client/         # typed same-origin API client and hooks
│       └── env.ts, db.ts   # environment validation, Prisma client singleton
├── tests/                  # vitest integration suite (99 tests: auth, orgs, tenancy)
├── prisma/                 # schema.prisma — the M1 data model
├── docs/                   # architecture, decisions (ADRs), security review
├── infra/                  # Docker artifacts, deployment notes
├── scripts/                # db-provider.mjs (provider switch), test-postgres.mjs
├── services/runtime/       # placeholder for the future execution runtime
├── public/                 # static assets
└── db/                     # SQLite database file (gitignored, local development only)
```

## Monorepo note

This sandbox workspace maps to the future `apps/web` package of the planned pnpm/Turborepo monorepo. The physical split is deferred and documented in [docs/decisions/ADR-001-sandbox-monorepo-layout.md](docs/decisions/ADR-001-sandbox-monorepo-layout.md).

## License

Proprietary — all rights reserved. License terms to be finalized before public release (see [Community edition direction](#community-edition-direction)).
