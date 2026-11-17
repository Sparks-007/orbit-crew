import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";
import { hasPermission, type Permission } from "@/lib/contracts/rbac";
import type { Role } from "@/lib/contracts/api";
import {
  hashSessionToken,
  SESSION_COOKIE,
  SESSION_TTL_MS,
} from "./session";

/**
 * Server-side authorization guards (M1: multi-tenant authorization).
 *
 * Rules enforced here, on every request, server-side:
 * - Identity comes exclusively from the session cookie (never the body).
 * - Organization access is resolved through the Membership table — an
 *   authenticated user without a membership row gets 404 (no existence leak).
 * - Role checks run server-side before privileged operations.
 * - Frontend visibility never grants anything.
 */

export interface AuthContext {
  user: { id: string; email: string; name: string };
  sessionId: string;
}

export interface OrgContext {
  auth: AuthContext;
  organization: {
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
  };
  membership: { id: string; role: Role };
}

export async function requireAuth(req: NextRequest): Promise<AuthContext> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) throw ApiError.unauthorized("Authentication required.");

  const tokenHash = hashSessionToken(token);
  const session = await db.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (
    !session ||
    session.revokedAt !== null ||
    session.expiresAt.getTime() <= Date.now()
  ) {
    throw ApiError.unauthorized(
      "Your session is invalid or has expired. Please sign in again."
    );
  }

  // Sliding refresh: extend sessions that are past half of their lifetime.
  const remaining = session.expiresAt.getTime() - Date.now();
  if (remaining < SESSION_TTL_MS / 2) {
    await db.session.update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
    });
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name ?? "",
    },
    sessionId: session.id,
  };
}

export async function requireOrgContext(
  req: NextRequest,
  slug: string,
  permission?: Permission
): Promise<OrgContext> {
  const auth = await requireAuth(req);
  const membership = await db.membership.findFirst({
    where: { userId: auth.user.id, organization: { slug } },
    include: { organization: true },
  });

  if (!membership) {
    // 404 rather than 403: do not reveal that the organization exists.
    throw ApiError.notFound("Organization not found.");
  }

  const role = membership.role as Role;
  if (permission && !hasPermission(role, permission)) {
    throw ApiError.forbidden();
  }

  return {
    auth,
    organization: membership.organization,
    membership: { id: membership.id, role },
  };
}
