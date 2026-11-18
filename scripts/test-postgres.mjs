#!/usr/bin/env node
/**
 * Run the integration test suite against PostgreSQL and restore the SQLite
 * sandbox default afterwards (even when tests fail).
 *
 * Required environment:
 *   PG_TEST_URL=postgres://user:password@host:port/database
 *
 * The database must exist but can be empty — the schema is applied with
 * `prisma db push`, mirroring the fresh-install path (no migrations exist
 * yet; see docs/architecture/database.md). CI provides a postgres:16
 * service container and sets PG_TEST_URL accordingly.
 */
import { spawnSync } from "node:child_process";

const url = process.env.PG_TEST_URL;
if (!url) {
  console.error(
    "PG_TEST_URL is not set. Example:\n" +
      "  PG_TEST_URL=postgres://orbit:orbit@127.0.0.1:5432/orbit_crew_test bun run test:pg"
  );
  process.exit(1);
}
if (!/^postgres(ql)?:\/\//.test(url)) {
  console.error("PG_TEST_URL must be a postgres:// connection string.");
  process.exit(1);
}

const schema = "prisma/schema.prisma";
const run = (command, args, env) => {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

try {
  run("node", ["scripts/db-provider.mjs", "postgresql"]);
  run("bunx", ["prisma", "generate"]);
  run("bunx", ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"], {
    DATABASE_URL: url,
  });
  run("bunx", ["vitest", "run"], { DATABASE_URL: url });
} finally {
  // Restore the sandbox default so local dev is never left on postgres.
  run("node", ["scripts/db-provider.mjs", "sqlite"]);
  run("bunx", ["prisma", "generate"]);
}
