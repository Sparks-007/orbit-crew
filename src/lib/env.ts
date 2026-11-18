import { z } from "zod";

/**
 * Environment validation (M1 requirement).
 *
 * Fail-fast policy:
 * - In production: an invalid configuration throws on first access.
 * - In development: a missing AUTH_SECRET falls back to a clearly-labelled
 *   insecure development secret with a loud warning, so the sandbox/dev
 *   environment can boot without secrets. Never commit a real AUTH_SECRET.
 */

const DEV_FALLBACK_SECRET =
  "orbit-crew-dev-insecure-secret-change-me-0000000000000000";

/**
 * Placeholder values copied verbatim from .env.example would pass a plain
 * length check, so production additionally rejects any AUTH_SECRET that
 * still looks like the documented placeholder. Fail-safe beats fail-open.
 */
function looksLikePlaceholder(secret: string): boolean {
  return /^change-me/i.test(secret);
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters (generate with: openssl rand -base64 32)"),
  APP_URL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    AUTH_SECRET: process.env.AUTH_SECRET,
    APP_URL: process.env.APP_URL,
  });

  if (parsed.success) {
    cached = parsed.data;
    return cached;
  }

  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    if (
      process.env.AUTH_SECRET &&
      looksLikePlaceholder(process.env.AUTH_SECRET)
    ) {
      throw new Error(
        "Invalid environment configuration. AUTH_SECRET is still the .env.example placeholder — generate a unique secret (openssl rand -base64 32) before starting in production."
      );
    }
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.map(String).join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new Error(
      `Invalid environment configuration. ${detail}. Copy .env.example to .env and configure the required values before starting in production.`
    );
  }

  console.warn(
    "[env] AUTH_SECRET missing or invalid — falling back to an insecure development secret. This must never happen in production."
  );
  const nodeEnv = process.env.NODE_ENV;
  cached = {
    NODE_ENV:
      nodeEnv === "production" || nodeEnv === "test" ? nodeEnv : "development",
    AUTH_SECRET: DEV_FALLBACK_SECRET,
    APP_URL: process.env.APP_URL,
  };
  return cached;
}

export function isProductionEnv(): boolean {
  return getEnv().NODE_ENV === "production";
}

/**
 * @internal test-only — vitest mutates APP_URL between cases; the cache must
 * be cleared for the new value to be observed. Not part of the public API.
 */
export function resetEnvCacheForTests(): void {
  cached = null;
}
