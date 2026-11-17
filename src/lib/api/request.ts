import type { NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { ApiError } from "./errors";

/**
 * Best-effort client IP extraction for rate limiting and session audit.
 * The sandbox gateway (Caddy) and most reverse proxies set X-Forwarded-For.
 * NOTE: in production this must only trust the known proxy hop.
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

function hostnameOf(hostHeader: string): string {
  try {
    return new URL(`http://${hostHeader}`).hostname.toLowerCase();
  } catch {
    return hostHeader.toLowerCase();
  }
}

function isInternalHost(hostHeader: string): boolean {
  const h = hostnameOf(hostHeader);
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "0.0.0.0" ||
    h === "::1" ||
    h === "[::1]" ||
    h.endsWith(".localhost")
  );
}

/**
 * CSRF defense-in-depth for mutating requests.
 *
 * The session cookie uses SameSite=Lax, which already prevents cross-site
 * POSTs from carrying the cookie in modern browsers. This origin check adds
 * a second layer: if the browser sends an Origin header on a mutation and it
 * does not match the Host (or APP_URL), the request is rejected.
 *
 * Tolerances:
 * - No Origin header (non-browser clients) -> allowed (auth still required).
 * - Host rewritten to an internal address by the local preview gateway
 *   (Origin is external, Host is localhost) -> allowed, because SameSite=Lax
 *   still applies and this is how the sandbox preview proxy forwards.
 */
export function assertSameOrigin(req: NextRequest): void {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;

  const origin = req.headers.get("origin");
  if (!origin || origin === "null") return;

  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    throw ApiError.forbidden("Request origin could not be validated.");
  }

  const allowedHosts = new Set<string>();
  const hostHeader = req.headers.get("host");
  if (hostHeader) allowedHosts.add(hostHeader.toLowerCase());
  const appUrl = getEnv().APP_URL;
  if (appUrl) {
    try {
      allowedHosts.add(new URL(appUrl).host.toLowerCase());
    } catch {
      // APP_URL misconfigured is a config problem, not a security bypass.
    }
  }

  if (allowedHosts.has(originHost)) return;
  if (hostHeader && isInternalHost(hostHeader)) return;

  throw ApiError.forbidden("Cross-origin request blocked.");
}
