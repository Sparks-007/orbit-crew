/**
 * Global test environment.
 *
 * Requirements:
 * - DATABASE_URL must be provided by the runner script (test:sqlite /
 *   test:pg) and must point at a throwaway database. Refuse to run against
 *   anything that looks like a production URL.
 * - AUTH_SECRET gets a fixed test-only value so HMAC token hashes are
 *   deterministic across runs (never used outside vitest).
 */

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Run `bun run test:sqlite` or `bun run test:pg` instead of invoking vitest directly."
  );
}
if (/^(postgres|postgresql):/i.test(url) && /prod/i.test(url)) {
  throw new Error("Refusing to run tests against a URL containing 'prod'.");
}

process.env.AUTH_SECRET ??= "orbit-crew-test-secret-0123456789abcdef-0123456789";
(process.env as Record<string, string | undefined>).NODE_ENV ??= "test";
