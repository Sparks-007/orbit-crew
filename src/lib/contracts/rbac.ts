import type { Role } from "./api";

/**
 * Role-based access control matrix (M1 requirement).
 *
 * Hierarchy: OWNER > ADMIN > MEMBER
 *
 * Rules encoded here:
 * - A role grants a flat set of permissions (see ROLE_PERMISSIONS).
 * - An actor may only modify/remove a member whose role rank is strictly
 *   LOWER than the actor's own rank (canActOn) — this prevents admins from
 *   touching peers and owners from touching owners.
 * - Granting ADMIN or transferring ownership requires OWNER.
 */

export const ROLE_RANK: Record<Role, number> = {
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export type Permission =
  | "org:read"
  | "org:update"
  | "org:delete"
  | "member:read"
  | "member:add"
  | "member:add:admin"
  | "member:update:member"
  | "member:update:admin"
  | "member:remove:member"
  | "member:remove:admin"
  | "ownership:transfer";

const MEMBER_PERMISSIONS: readonly Permission[] = ["org:read", "member:read"];

const ADMIN_PERMISSIONS: readonly Permission[] = [
  ...MEMBER_PERMISSIONS,
  "org:update",
  "member:add",
  "member:update:member",
  "member:remove:member",
];

const OWNER_PERMISSIONS: readonly Permission[] = [
  ...ADMIN_PERMISSIONS,
  "org:delete",
  "member:add:admin",
  "member:update:admin",
  "member:remove:admin",
  "ownership:transfer",
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  MEMBER: MEMBER_PERMISSIONS,
  ADMIN: ADMIN_PERMISSIONS,
  OWNER: OWNER_PERMISSIONS,
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * True when the actor's role rank is strictly higher than the target's.
 * Used before modifying or removing a membership.
 */
export function canActOn(actorRole: Role, targetRole: Role): boolean {
  return ROLE_RANK[actorRole] > ROLE_RANK[targetRole];
}
