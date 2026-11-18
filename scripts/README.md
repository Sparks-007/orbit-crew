# Scripts

Utilities that are part of the repeatable workflow. Database one-liners live in `package.json`.

## Database provider switch

Prisma does not support `provider = env(...)`; the provider in
`prisma/schema.prisma` must be a literal. `db-provider.mjs` rewrites that
single line so the sandbox default (SQLite) and the production target
(PostgreSQL) share one schema file — no drifting schema copies.

```bash
node scripts/db-provider.mjs status       # print the current provider
node scripts/db-provider.mjs postgresql   # switch schema to postgresql
node scripts/db-provider.mjs sqlite       # restore the sandbox default
```

Locally the schema is committed as `sqlite`. CI switches it automatically for
the PostgreSQL test job.

## Tests

| Script | What it does |
| --- | --- |
| `bun run test` / `bun run test:sqlite` | Fresh throwaway SQLite DB (`db/test.db`) via `prisma db push`, then the full vitest suite. |
| `bun run test:pg` | Requires `PG_TEST_URL=postgres://…`. Switches the schema provider to PostgreSQL, regenerates the client, pushes the schema into an empty database, runs the suite, and always restores SQLite afterwards. |

Tests require no HTTP server: Next.js route handlers are invoked directly with
constructed `NextRequest`s, so origin/CSRF checks, rate limits, cookie flags
and error envelopes are covered hermetically.

## Postgres test runner

`test-postgres.mjs` orchestrates the `test:pg` flow above (switch → generate →
push → vitest → restore, with restore guaranteed on failure). CI provides the
PostgreSQL 16 service container and `PG_TEST_URL`
(see `.github/workflows/ci.yml`).

Do not commit one-off experimental scripts here; promote a script into this
directory (with a short header comment explaining when to run it) once it is
part of the repeatable workflow.
