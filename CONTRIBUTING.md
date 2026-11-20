# Contributing to Orbit Crew

Thanks for contributing. This document covers setup, branch and commit conventions, testing requirements, and the review checklist that every pull request must pass.

> Note: the project is pre-release and batch-gated — pull requests should implement only the work approved for the current milestone (see [ROADMAP.md](ROADMAP.md) for batch status).

## Development setup

Prerequisites: [Bun](https://bun.sh) 1.x.

```bash
bun install
cp .env.example .env      # set AUTH_SECRET: openssl rand -base64 32
bun run db:push           # create the SQLite database from prisma/schema.prisma
bun run dev               # http://localhost:3000
```

Useful scripts: `bun run lint`, `bun run typecheck`, `bun run test`, `bun run db:generate`, `bun run db:migrate`, `bun run db:reset`, `bun run db:provider` (print/switch the datasource provider).

`bun install` runs Prisma's postinstall client generation — `@prisma/client` and `@prisma/engines` are declared in `trustedDependencies` in `package.json`. If types appear missing after a fresh checkout, run `bunx prisma generate` explicitly.

## Branches

Branch from `main` using one of these prefixes:

- `feat/*` — new functionality
- `fix/*` — bug fixes
- `chore/*` — tooling, docs, dependency and infrastructure work

## Commits

Use Conventional Commits style in the summary line, e.g. `feat(orgs): add member removal guards`, `fix(auth): clamp session TTL refresh`, `chore(ci): add typecheck job`. The body should explain the why, not repeat the diff.

## Testing requirements

Every pull request must keep the automated suite green. CI (`.github/workflows/ci.yml`) enforces this on all pull requests with four jobs — `quality` (lint, typecheck, `prisma validate`), `tests-sqlite`, `tests-postgres` and `build` — so broken PRs cannot merge, but please run locally before opening:

- `bun run lint` and `bun run typecheck`.
- `bun run test` — the full integration suite (currently 99 tests: authentication, sessions, RBAC, cross-tenant isolation, origin/CSRF, rate limiting, ownership-transfer concurrency) runs against a throwaway SQLite database; no HTTP server or external services needed.
- For changes that touch the data layer (schema, queries, migrations, provider switching), also run `bun run test:pg` against a local PostgreSQL 16 when available — `PG_TEST_URL=postgres://user:pass@host:5432/db bun run test:pg`. The script switches the provider, regenerates the client, applies the schema, runs the suite and always restores SQLite afterwards. CI runs it against a `postgres:16-alpine` service container.
- Behavior changes need a test. New security-relevant behavior (auth, tenancy, RBAC, CSRF, rate limits) must include test coverage in `tests/` — do not open a PR that only exercises it manually.
- Do not disable, skip or weaken existing tests to make a PR pass. If a test encodes an outdated requirement, say so in the PR description and change it deliberately.

## Pull request checklist

- [ ] `bun run lint` passes.
- [ ] `bun run typecheck` passes.
- [ ] `bun run test` passes; `bun run test:pg` passes for data-layer changes.
- [ ] New behavior is covered by tests in `tests/`.
- [ ] Security self-review:
  - [ ] Every new database query is tenant-scoped (organization/membership constrained in the `where` clause, never by client-submitted IDs alone).
  - [ ] Every privileged operation checks RBAC server-side (`hasPermission` / `canActOn` in `src/lib/contracts/rbac.ts`).
  - [ ] No secrets, tokens or credentials appear in logs, errors or test fixtures.
  - [ ] Every new request input is validated with a Zod schema from `src/lib/contracts/`.
- [ ] Documentation updated (README, docs/, CHANGELOG) when behavior or architecture changes.
- [ ] Milestone discipline: implement only the work approved for the current batch. Do not pull scope forward from later milestones.

## Security considerations for contributions

- Never commit secrets (`.env`, API keys, tokens); `.env` is gitignored and only `.env.example` with placeholders is tracked.
- Do not open public issues for security problems. Follow the private reporting process in [SECURITY.md](SECURITY.md).
- Preserve the security architecture: server-side identity resolution, membership-scoped queries, the 404 no-leak convention for foreign-tenant resources, same-origin enforcement on mutations, and fail-fast production environment validation. Changes that relax any of these need explicit maintainer approval and test coverage proving the risk is addressed.
- Keep dependencies minimal; new packages must have a clear justification and license compatibility (the project is licensed under AGPL-3.0).
