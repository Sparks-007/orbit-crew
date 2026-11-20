# Orbit Crew — M1 CI Prisma Fix (Change Manifest)

Base commit: `e600163` (audit commit — "audit(m1): independent verification, security hardening, persistent tests")
Result commit in dev environment: `855a07b4f0fdecedd4703714e54ed7113d0c534e` — "fix(ci): generate Prisma Client in clean environments"

## Purpose

Fix the four GitHub Actions CI failures observed on the first run of commit `e600163`
(`quality`, `tests-sqlite`, `build` FAILED; `tests-postgres` PASSED).

Root cause: Bun does not execute `@prisma/client`'s `postinstall` script unless the
package is listed in `trustedDependencies`. In a clean CI checkout no Prisma Client was
generated, so `@prisma/client` exported neither `Prisma` nor `PrismaClient`, and
`.prisma/client/default` did not exist. The only passing job (tests-postgres) was the
only job whose script ran `prisma generate` explicitly. The TypeScript "`error` is
unknown" reports in the auth/organization services were downstream of the unresolved
`Prisma` namespace and disappear once the client is generated (verified: `tsc --noEmit`
exit 0, no source changes required).

## Files in this archive

| # | Relative path | Change type | Purpose |
|---|---|---|---|
| 1 | `package.json` | MODIFIED | (a) Add `"trustedDependencies": ["@prisma/client", "@prisma/engines"]` so Bun runs Prisma's postinstall generation on clean installs. (b) Make `test:sqlite` provider-safe and self-generating: it now forces the SQLite provider (`node scripts/db-provider.mjs sqlite`) before touching the schema, and runs `prisma generate` explicitly before `vitest run`. `--skip-generate` is retained on `prisma db push`; generation is a separate, explicit, correctly-ordered step. |
| 2 | `.github/workflows/ci.yml` | MODIFIED | Add an explicit `bunx prisma generate` step to the `quality` job (before lint/typecheck) and to the `build` job (before `next build`, which type-checks since `ignoreBuildErrors` was removed in the audit commit). The four jobs remain: quality, tests-sqlite, tests-postgres, build. The PostgreSQL job keeps its postgres:16-alpine service container unchanged. |
| 3 | `bun.lock` | MODIFIED | Lockfile regenerated after the `package.json` change; records `trustedDependencies` for `@prisma/client` and `@prisma/engines` so `bun install --frozen-lockfile` stays valid. |

No files were deleted or renamed (`DELETED_FILES.md` intentionally omitted).

## What was verified before packaging

- Clean-environment install: `rm -rf node_modules` + `bun install --frozen-lockfile`
  generates the Prisma Client automatically (postinstall now trusted).
- `bun run lint` — PASS.
- `bun run typecheck` — PASS (unknown-type errors gone).
- `bun run test:sqlite` — PASS, 99/99.
- `bun run test:pg` against an isolated PostgreSQL 16.15 — PASS, 99/99; provider
  automatically restored to SQLite afterwards.
- Production build with placeholder env — PASS.
- Provider switching verified for both providers; committed schema is SQLite.

## Application notes

- Extract this archive directly into the existing `orbit-crew` project root (the
  folder containing `package.json`), replacing the three existing files.
- Apply on top of commit `e600163` in your Windows repository, then commit locally
  with the message: `fix(ci): generate Prisma Client in clean environments`.
- This archive contains no secrets, no generated/build artifacts, no logs, and no
  unchanged project files.
