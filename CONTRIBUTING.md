# Contributing to Orbit Crew

Thanks for contributing. This document covers setup, branch and commit conventions, and the review checklist that every pull request must pass.

## Development setup

Prerequisites: [Bun](https://bun.sh) 1.x.

```bash
bun install
cp .env.example .env      # set AUTH_SECRET: openssl rand -base64 32
bun run db:push           # create the SQLite database from prisma/schema.prisma
bun run dev               # http://localhost:3000
```

Useful scripts: `bun run lint`, `bun run typecheck`, `bun run db:generate`, `bun run db:migrate`, `bun run db:reset`.

## Branches

Branch from `main` using one of these prefixes:

- `feat/*` — new functionality
- `fix/*` — bug fixes
- `chore/*` — tooling, docs, dependency and infrastructure work

## Commits

Use Conventional Commits style in the summary line, e.g. `feat(orgs): add member removal guards`, `fix(auth): clamp session TTL refresh`, `chore(ci): add typecheck job`. The body should explain the why, not repeat the diff.

## Pull request checklist

- [ ] `bun run lint` passes.
- [ ] `bun run typecheck` passes.
- [ ] Security self-review:
  - [ ] Every new database query is tenant-scoped (organization/membership constrained in the `where` clause, never by client-submitted IDs alone).
  - [ ] Every privileged operation checks RBAC server-side (`hasPermission` / `canActOn` in `src/lib/contracts/rbac.ts`).
  - [ ] No secrets, tokens or credentials appear in logs, errors or test fixtures.
  - [ ] Every new request input is validated with a Zod schema from `src/lib/contracts/`.
- [ ] Documentation updated (README, docs/, CHANGELOG) when behavior or architecture changes.
- [ ] Milestone discipline: implement only the work approved for the current batch. Do not pull scope forward from later milestones.

## Reporting vulnerabilities

Do not open public issues for security problems. Follow the private reporting process in [SECURITY.md](SECURITY.md).
