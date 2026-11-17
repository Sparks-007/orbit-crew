# Orbit Crew

**Your AI workforce. Working together.**

Orbit Crew is a multi-tenant SaaS platform for creating, managing and working with AI employees. Organizations register, invite teammates, and delegate work to AI employees that execute tasks on their behalf. V1 delivers individual AI employees; the AI Coordinator and multi-agent teams arrive in V2.

## Status

Phase 1 — V1 Core AI Workforce · Batch 1 · Milestone **M1 — Project Foundation** (v0.1.0, 2026-11-17). Full plan: [ROADMAP.md](ROADMAP.md).

M1 delivers the secure control-plane foundation, as implemented in this repository:

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

## Tech stack

| Layer | Technology | Version |
| --- | --- | --- |
| Framework | Next.js (App Router, standalone output) | 16.1 |
| UI | React | 19 |
| Language | TypeScript | 5 |
| Styling | Tailwind CSS + shadcn/ui (Radix primitives) | 4 |
| ORM / database | Prisma — SQLite in this dev sandbox; PostgreSQL is the production target | 6.11 |
| Validation | Zod | 4 |
| Runtime / package manager | Bun | 1.x |

## Quickstart

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
| `bun run db:push` | Push `prisma/schema.prisma` to the database |
| `bun run db:generate` | Generate the Prisma client |
| `bun run db:migrate` | Create/apply a development migration |
| `bun run db:reset` | Reset the database |

## Repository structure

```
.
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
├── prisma/                 # schema.prisma — the M1 data model
├── docs/                   # architecture, decisions (ADRs), security
├── infra/                  # Docker artifacts, deployment notes
├── services/runtime/       # placeholder for the future execution runtime
├── scripts/                # dev/ops utilities (placeholder)
├── public/                 # static assets
└── db/                     # SQLite database file (gitignored, sandbox only)
```

## Security

Security is a primary M1 deliverable: scrypt password hashing, HMAC-hashed session tokens, httpOnly/SameSite cookies, membership-scoped authorization with a strict RBAC matrix, 404 (not 403) responses for foreign-tenant resources, same-origin enforcement for mutations, and fail-fast environment validation. See [docs/security/SECURITY-REVIEW-M1.md](docs/security/SECURITY-REVIEW-M1.md), [SECURITY.md](SECURITY.md), and [docs/architecture/overview.md](docs/architecture/overview.md).

## Monorepo note

This sandbox workspace maps to the future `apps/web` package of the planned pnpm/Turborepo monorepo. The physical split is deferred and documented in [docs/decisions/ADR-001-sandbox-monorepo-layout.md](docs/decisions/ADR-001-sandbox-monorepo-layout.md).

## License

Proprietary — all rights reserved. License terms to be finalized before public release.
