import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Orbit Crew integration tests.
 *
 * These tests run against a real database (SQLite by default in the sandbox,
 * PostgreSQL in CI via .github/workflows/ci.yml). DATABASE_URL must point at
 * a throwaway database that the caller prepares with `prisma db push` — see
 * the `test:sqlite` and `test:pg` scripts in package.json.
 *
 * No HTTP server is required: Next.js route handlers are invoked directly
 * with constructed NextRequest objects, so CSRF/origin checks, rate limits,
 * cookie flags and error envelopes are covered without a network hop.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
    // Run test files sequentially — they share one throwaway database.
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
