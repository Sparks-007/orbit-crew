import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import type { Role } from "@/lib/contracts/api";

/**
 * Shared helpers for the integration test suite.
 * All data lives in a throwaway database wiped between tests (see resetDb).
 */

/** Delete all rows in foreign-key-safe order. Idempotent, no manual cleanup. */
export async function resetDb(): Promise<void> {
  await db.membership.deleteMany();
  await db.session.deleteMany();
  await db.organization.deleteMany();
  await db.user.deleteMany();
}

export interface TestUser {
  id: string;
  email: string;
  name: string;
}

export async function createUser(name: string): Promise<TestUser> {
  const { hashPassword } = await import("@/lib/auth/password");
  const email = `${name}-${randomBytes(6).toString("hex")}@test.example`;
  const user = await db.user.create({
    data: { email, name, passwordHash: await hashPassword("correct horse battery staple") },
  });
  return { id: user.id, email: user.email, name: user.name ?? name };
}

export async function createOrgWithOwner(ownerId: string, slug: string) {
  const organization = await db.organization.create({ data: { name: `Org ${slug}`, slug } });
  const membership = await db.membership.create({
    data: { userId: ownerId, organizationId: organization.id, role: "OWNER" },
  });
  return { organization, membership };
}

export async function addMembership(
  userId: string,
  organizationId: string,
  role: Role
): Promise<{ id: string; role: Role }> {
  const membership = await db.membership.create({
    data: { userId, organizationId, role },
  });
  return { id: membership.id, role: membership.role as Role };
}

export function uniqueSlug(prefix = "org"): string {
  return `${prefix}-${randomBytes(4).toString("hex")}`;
}

export function uniqueEmail(): string {
  return `user-${randomBytes(6).toString("hex")}@test.example`;
}

/** Unique per-test IP so the in-memory rate limiter never bleeds across tests. */
export function uniqueIp(): string {
  return `10.${randomBytes(1)[0]}.${randomBytes(1)[0]}.${randomBytes(1)[0]}`;
}

/** Build a NextRequest as if it hit the local server. */
export function makeRequest(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: unknown } = {}
): NextRequest {
  const headers = new Headers(init.headers);
  const method = (init.method ?? "GET").toUpperCase();
  let body: string | undefined;
  if (init.body !== undefined) {
    body = typeof init.body === "string" ? init.body : JSON.stringify(init.body);
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
  }
  // Real HTTP traffic always carries a Host header, but NextRequest does not
  // synthesize one from the URL when constructed programmatically — set it
  // explicitly (overridable per test) so origin checks see server-realistic input.
  if (!headers.has("host")) headers.set("host", "localhost:3000");
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : body,
  });
}

export async function expectApiError(fn: () => Promise<unknown>): Promise<{ code: string; message: string }> {
  try {
    await fn();
  } catch (error) {
    const e = error as { name?: string; code?: string; message?: string };
    if (e?.name === "ApiError" && typeof e.code === "string") {
      return { code: e.code, message: e.message ?? "" };
    }
    throw new Error(`Expected ApiError but got: ${String(error)}`);
  }
  throw new Error("Expected ApiError but the call succeeded");
}
