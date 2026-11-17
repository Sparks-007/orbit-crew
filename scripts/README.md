# Scripts

Placeholder directory for dev/ops utilities to be added in later milestones (e.g. seed data, tenant provisioning, backup jobs, deploy helpers).

Today, database scripts live in `package.json`:

| Script | Command |
| --- | --- |
| `bun run db:push` | `prisma db push --accept-data-loss` |
| `bun run db:generate` | `prisma generate` |
| `bun run db:migrate` | `prisma migrate dev` |
| `bun run db:reset` | `prisma migrate reset` |

Do not commit one-off experimental scripts here; promote a script into this directory (with a short header comment explaining when to run it) once it is part of the repeatable workflow.
