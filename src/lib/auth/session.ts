import { createHmac, randomBytes } from "node:crypto";
import { getEnv } from "@/lib/env";

/**
 * Session token design (M1 security requirement).
 *
 * - Token: 32 random bytes, base64url — the ONLY thing the browser holds.
 * - At rest: HMAC-SHA256(AUTH_SECRET, token). A stolen database dump cannot
 *   be replayed as sessions without the application secret.
 * - Cookie: httpOnly (no JS access — nothing is stored in browser storage),
 *   SameSite=Lax (CSRF baseline), Secure in production, 30-day absolute TTL
 *   with sliding refresh past the halfway point (implemented in guards.ts).
 */

export const SESSION_COOKIE = "oc_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function hashSessionToken(token: string): string {
  const secret = getEnv().AUTH_SECRET;
  return createHmac("sha256", secret).update(token).digest("hex");
}

export interface NewSessionToken {
  token: string;
  tokenHash: string;
  expiresAt: Date;
}

export function createSessionToken(): NewSessionToken {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  };
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: getEnv().NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}
