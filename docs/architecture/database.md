# Database

Status: M1 — Project Foundation (v0.1.0, 2026-11-17).

## Current state (sandbox)

- Provider: **SQLite** through Prisma (`datasource db { provider = "sqlite" }` in `prisma/schema.prisma`).
- Location: `DATABASE_URL=file:/home/z/my-project/db/custom.db` (see `.env.example`). The `db/` directory is gitignored.
- Schema management: `bun run db:push` (declarative push with `--accept-data-loss`) — acceptable for sandbox iteration; migrations are adopted at the PostgreSQL switch.

## Production target

PostgreSQL + Prisma. The schema is written provider-portable: it uses no PostgreSQL-only types, and the membership role is stored as a validated string (`"OWNER" | "ADMIN" | "MEMBER"` — checked in `src/lib/contracts/api.ts` and `rbac.ts`) rather than a native enum.

## Provider switch steps

1. Change the datasource provider to `"postgresql"` in `prisma/schema.prisma`.
2. Set `DATABASE_URL` to the PostgreSQL connection string (the compose stack in `infra/docker/docker-compose.yml` provides `postgres://orbit:orbit@db:5432/orbit_crew`).
3. Adopt `prisma migrate`: create an initial migration from the current schema and replace the `db:push` workflow (`db:migrate` / `db:reset` scripts already exist in `package.json`).
4. Verify indexes: `Session.userId`, `Membership.organizationId`, and the unique constraints on `User.email`, `Organization.slug`, `Session.tokenHash`, `Membership(userId, organizationId)`.

## Optional PostgreSQL upgrades after the switch

- Native `enum` type for the membership role (replacing the validated string).
- `timestamptz` columns with database-level defaults instead of Prisma-managed timestamps.
- Partial indexes (e.g. active sessions where `revokedAt IS NULL`).

## Planned tables (M2+)

Not present in the schema today; one-line previews:

- **Credentials / vault (M2)** — customer-provided model API keys (BYOK), encrypted at rest, scoped to an organization.
- **Employees (M3)** — AI employee definitions: name, role, instructions, model and credential selection.
- **Tasks (M4)** — assigned work per employee: input, status, result, lifecycle timestamps.
- **Runs (M4)** — individual execution attempts of a task: streaming output, cancellation, retries.
- **Memories (M5)** — per-employee memory entries and file references used during task execution.
