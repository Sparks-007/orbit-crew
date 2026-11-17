import { ApiError } from "./errors";

/**
 * Minimal in-memory fixed-window rate limiter (M1).
 *
 * Suitable for the single-instance sandbox/dev deployment. In production,
 * replace the Map with a shared store (e.g. PostgreSQL-backed or Redis) so
 * limits hold across instances — tracked in docs/security/SECURITY-REVIEW-M1.md.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

function sweep(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Throws ApiError("RATE_LIMITED") when the limit is exceeded.
 * Key format suggestion: "<action>:<subject>" e.g. "login:ip:1.2.3.4".
 */
export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) sweep(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  bucket.count += 1;
  if (bucket.count > limit) throw ApiError.rateLimited();
}
