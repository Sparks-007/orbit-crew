# Orbit Crew — M1 CI `prisma validate` Fix (Change Manifest)

Base commit: `855a07b4f0fdecedd4703714e54ed7113d0c534e` ("fix(ci): generate Prisma Client in clean environments")
Result commit in dev environment: `bfa52ef9c0f86c1add9074b87073cd6446c61cdc` — "fix(ci): provide DATABASE_URL placeholder for prisma validate"

## Problem

GitHub Actions `quality` job failed at `bunx prisma validate` with
`Error code: P1012 — Environment variable not found: DATABASE_URL`.

Why: the schema declares `url = env("DATABASE_URL")`, and the Prisma CLI requires
that variable to be **defined** even though `validate` never connects to a database.
Locally the gitignored `.env` file provides it; a clean CI checkout has no `.env`.
`prisma generate` (the preceding step) does not require it, which is why only the
validate step failed. The `build` job already sets `DATABASE_URL` at job level, and
both test scripts set their own URLs — only the `quality` job's validate step was
missing it.

## Files in this archive

| # | Relative path | Change type | Purpose |
|---|---|---|---|
| 1 | `.github/workflows/ci.yml` | MODIFIED | Add a step-level `env: DATABASE_URL: file:./dev.db` (safe SQLite placeholder, no real credentials) to the `bunx prisma validate` step of the `quality` job, with an explanatory comment. All four jobs, their order, and the PostgreSQL service container are unchanged. |
| 2 | `.gitignore` | MODIFIED | Add `public/*.zip` under a new "delivered patch archives" comment. Reason: the dev environment's platform auto-commit machinery committed the previous delivery ZIP (`public/Orbit-Crew_M1-CI-Prisma-Fix_e600163.zip`) into local-only history as a UUID commit; this ignore rule prevents patch artifacts from ever being committed again. The rule does not affect Next.js static serving of the ZIP for download. If you prefer not to carry this change, drop the `.gitignore` file from the archive — it is independent of the CI fix. |

No files were deleted or renamed (`DELETED_FILES.md` intentionally omitted).

## What was verified before packaging

- Reproduced the exact CI failure in a clean directory (no `.env`, no
  `DATABASE_URL`): `prisma validate` → `P1012 Environment variable not found:
  DATABASE_URL`.
- Applied the fix value: `DATABASE_URL=file:./dev.db prisma validate` →
  "The schema is valid".
- Regression: `bunx prisma validate` in the real project → valid.
- YAML parse check: all four jobs present (quality, tests-sqlite, tests-postgres,
  build).
- Archive contents byte-compared against commit `bfa52ef`.

## Application notes

- Extract directly into your existing `orbit-crew` project root (the folder
  containing `package.json`), replacing `.github/workflows/ci.yml` and `.gitignore`.
- Commit locally on top of your `855a07b`-equivalent commit with the message:
  `fix(ci): provide DATABASE_URL placeholder for prisma validate`.
- Contains no secrets, no generated/build artifacts, no logs, no database files,
  and no unchanged project files.
