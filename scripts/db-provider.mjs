#!/usr/bin/env node
/**
 * Switch the Prisma datasource provider between the sandbox default (SQLite)
 * and the production target (PostgreSQL) by rewriting the single `provider`
 * line in prisma/schema.prisma.
 *
 * Why a runtime rewrite? Prisma does not support `provider = env(...)`; the
 * schema file must carry a literal provider. Keeping one schema file avoids
 * model drift between two schema copies (see docs/architecture/database.md).
 *
 * Usage:
 *   node scripts/db-provider.mjs sqlite|postgresql|status
 *
 * CI uses this to run the integration test suite against PostgreSQL
 * (.github/workflows/ci.yml). Locally the schema is committed as sqlite;
 * run `node scripts/db-provider.mjs sqlite` afterwards to restore it.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SCHEMA = resolve(process.cwd(), "prisma/schema.prisma");
const SQLITE = 'provider = "sqlite"';
const POSTGRES = 'provider = "postgresql"';

const command = process.argv[2];

function currentProvider() {
  const content = readFileSync(SCHEMA, "utf8");
  if (content.includes(POSTGRES)) return "postgresql";
  if (content.includes(SQLITE)) return "sqlite";
  return "unknown";
}

if (!command || command === "status") {
  console.log(currentProvider());
  process.exit(0);
}

if (command !== "sqlite" && command !== "postgresql") {
  console.error(
    `Unknown provider "${command}". Use: sqlite | postgresql | status`
  );
  process.exit(1);
}

const provider = currentProvider();
if (provider === "unknown") {
  console.error(
    "Could not find a datasource provider line in prisma/schema.prisma — refusing to edit."
  );
  process.exit(1);
}

if (provider === command) {
  console.log(`db provider already: ${provider}`);
  process.exit(0);
}

const content = readFileSync(SCHEMA, "utf8");
const next =
  command === "postgresql"
    ? content.replace(SQLITE, POSTGRES)
    : content.replace(POSTGRES, SQLITE);
writeFileSync(SCHEMA, next, "utf8");
console.log(`db provider switched: ${provider} -> ${command}`);
