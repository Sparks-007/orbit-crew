import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";
import { canActOn, hasPermission, type Permission } from "@/lib/contracts/rbac";
import { RESERVED_ORG_SLUGS } from "@/lib/contracts/api";
import type {
  AddMemberInput,
  CreateOrgInput,
  CreateOrgResponse,
  MemberDto,
  OrganizationSummary,
  Role,
  UpdateMemberRoleInput,
} from "@/lib/contracts/api";

/**
 * Organization + membership domain logic (M1: organizations, memberships,
 * role-based permissions, multi-tenant authorization).
 *
 * Every function takes the resolved server-side context (never client
 * assertions) and enforces the RBAC matrix from src/lib/contracts/rbac.ts.
 */

const SELECT_USER = { id: true, name: true, email: true } as const;

type MembershipWithUser = {
  id: string;
  role: string;
  createdAt: Date;
  user: { id: string; name: string | null; email: string };
};

function toMemberDto(m: MembershipWithUser): MemberDto {
  return {
    id: m.id,
    user: m.user,
    role: m.role as Role,
    createdAt: m.createdAt.toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Organizations                                                       */
/* ------------------------------------------------------------------ */

export async function createOrganization(
  userId: string,
  input: CreateOrgInput
): Promise<CreateOrgResponse> {
  if (RESERVED_ORG_SLUGS.has(input.slug)) {
    throw ApiError.conflict("This slug is reserved and cannot be used.");
  }

  try {
    return await db.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: input.name, slug: input.slug },
      });
      await tx.membership.create({
        data: { userId, organizationId: organization.id, role: "OWNER" },
      });
      return {
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          createdAt: organization.createdAt.toISOString(),
        },
        role: "OWNER" as const,
      };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw ApiError.conflict("This organization slug is already taken.");
    }
    throw error;
  }
}

export async function listOrganizations(
  userId: string
): Promise<OrganizationSummary[]> {
  const memberships = await db.membership.findMany({
    where: { userId },
    include: {
      organization: { include: { _count: { select: { memberships: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    role: m.role as Role,
    createdAt: m.organization.createdAt.toISOString(),
    memberCount: m.organization._count.memberships,
  }));
}

export async function listMembers(organizationId: string): Promise<MemberDto[]> {
  const memberships = await db.membership.findMany({
    where: { organizationId },
    include: { user: { select: SELECT_USER } },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map(toMemberDto);
}

export async function renameOrganization(
  organizationId: string,
  name: string
): Promise<{ id: string; name: string; slug: string }> {
  const organization = await db.organization.update({
    where: { id: organizationId },
    data: { name },
  });
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
  };
}

export async function deleteOrganization(organizationId: string): Promise<void> {
  try {
    // Memberships cascade-delete (see schema onDelete: Cascade).
    await db.organization.delete({ where: { id: organizationId } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw ApiError.notFound("Organization not found.");
    }
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* Members                                                             */
/* ------------------------------------------------------------------ */

export async function addMember(
  organizationId: string,
  input: AddMemberInput
): Promise<MemberDto> {
  const email = input.email.trim().toLowerCase();

  const targetUser = await db.user.findUnique({ where: { email } });
  if (!targetUser) {
    // M1 has no invitation emails; members must already have accounts.
    throw ApiError.notFound(
      "No Orbit Crew account exists with that email address. Ask them to register first."
    );
  }

  const existing = await db.membership.findUnique({
    where: { userId_organizationId: { userId: targetUser.id, organizationId } },
  });
  if (existing) {
    throw ApiError.conflict("This user is already a member of the organization.");
  }

  const membership = await db.membership.create({
    data: { userId: targetUser.id, organizationId, role: input.role },
    include: { user: { select: SELECT_USER } },
  });
  return toMemberDto(membership);
}

export interface MemberOperationContext {
  organizationId: string;
  actorMembershipId: string;
  actorRole: Role;
  membershipId: string;
}

export async function updateMemberRole(
  ctx: MemberOperationContext,
  input: UpdateMemberRoleInput
): Promise<MemberDto> {
  const target = await db.membership.findFirst({
    where: { id: ctx.membershipId, organizationId: ctx.organizationId },
    include: { user: { select: SELECT_USER } },
  });
  if (!target) throw ApiError.notFound("Member not found.");

  const targetRole = target.role as Role;
  if (input.role === targetRole) {
    return toMemberDto(target); // idempotent no-op
  }

  // Self role changes are not allowed on this endpoint. Ownership transfer
  // (newRole = OWNER) is the only way the owner's role changes.
  if (target.id === ctx.actorMembershipId) {
    throw ApiError.forbidden(
      "You cannot change your own role here. Use ownership transfer to hand over ownership."
    );
  }

  if (input.role === "OWNER") {
    if (!hasPermission(ctx.actorRole, "ownership:transfer")) {
      throw ApiError.forbidden("Only the owner can transfer ownership.");
    }
    return await db.$transaction(async (tx) => {
      await tx.membership.update({
        where: { id: ctx.actorMembershipId },
        data: { role: "ADMIN" },
      });
      const updated = await tx.membership.update({
        where: { id: target.id },
        data: { role: "OWNER" },
        include: { user: { select: SELECT_USER } },
      });
      return toMemberDto(updated);
    });
  }

  // Cannot act on members with equal or higher rank.
  if (!canActOn(ctx.actorRole, targetRole)) {
    throw ApiError.forbidden(
      "You cannot modify a member whose role is equal to or higher than yours."
    );
  }
  const required: Permission =
    targetRole === "ADMIN" ? "member:update:admin" : "member:update:member";
  if (!hasPermission(ctx.actorRole, required)) {
    throw ApiError.forbidden();
  }

  const updated = await db.membership.update({
    where: { id: target.id },
    data: { role: input.role },
    include: { user: { select: SELECT_USER } },
  });
  return toMemberDto(updated);
}

export async function removeMember(ctx: MemberOperationContext): Promise<void> {
  const target = await db.membership.findFirst({
    where: { id: ctx.membershipId, organizationId: ctx.organizationId },
  });
  if (!target) throw ApiError.notFound("Member not found.");

  const targetRole = target.role as Role;

  if (targetRole === "OWNER") {
    throw ApiError.forbidden(
      "The organization owner cannot be removed. Transfer ownership first."
    );
  }
  if (target.id === ctx.actorMembershipId) {
    throw ApiError.forbidden(
      "You cannot remove yourself from the organization in this release."
    );
  }
  if (!canActOn(ctx.actorRole, targetRole)) {
    throw ApiError.forbidden(
      "You cannot remove a member whose role is equal to or higher than yours."
    );
  }
  const required: Permission =
    targetRole === "ADMIN" ? "member:remove:admin" : "member:remove:member";
  if (!hasPermission(ctx.actorRole, required)) {
    throw ApiError.forbidden();
  }

  await db.membership.delete({ where: { id: target.id } });
}
