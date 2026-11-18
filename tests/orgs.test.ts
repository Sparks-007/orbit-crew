import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  createOrganization,
  listOrganizations,
  listMembers,
  renameOrganization,
  deleteOrganization,
  addMember,
  updateMemberRole,
  removeMember,
  type MemberOperationContext,
} from "@/lib/orgs/service";
import { hasPermission, canActOn } from "@/lib/contracts/rbac";
import {
  createOrgSchema,
  orgSlugSchema,
  addMemberSchema,
  registerSchema,
  RESERVED_ORG_SLUGS,
} from "@/lib/contracts/api";
import {
  expectApiError,
  resetDb,
  createUser,
  createOrgWithOwner,
  addMembership,
  uniqueSlug,
  uniqueEmail,
  type TestUser,
} from "./helpers";

let owner: TestUser;
let admin: TestUser;
let member: TestUser;
let outsider: TestUser;
let orgId: string;
let slug: string;
let ownerMembershipId: string;
let adminMembershipId: string;
let memberMembershipId: string;

beforeEach(async () => {
  await resetDb();
  owner = await createUser("owner");
  admin = await createUser("admin");
  member = await createUser("member");
  outsider = await createUser("outsider");
  slug = uniqueSlug();
  const { organization, membership } = await createOrgWithOwner(owner.id, slug);
  orgId = organization.id;
  ownerMembershipId = membership.id;
  adminMembershipId = (await addMembership(admin.id, orgId, "ADMIN")).id;
  memberMembershipId = (await addMembership(member.id, orgId, "MEMBER")).id;
});

afterAll(async () => {
  await db.$disconnect();
});

function opCtx(actorMembershipId: string, actorRole: "OWNER" | "ADMIN" | "MEMBER", membershipId: string): MemberOperationContext {
  return {
    organizationId: orgId,
    actorMembershipId,
    actorRole,
    membershipId,
  };
}

/* ------------------------------------------------------------------ */
/* RBAC matrix (unit)                                                  */
/* ------------------------------------------------------------------ */

describe("rbac matrix", () => {
  it("MEMBER can only read", () => {
    expect(hasPermission("MEMBER", "org:read")).toBe(true);
    expect(hasPermission("MEMBER", "member:read")).toBe(true);
    expect(hasPermission("MEMBER", "org:update")).toBe(false);
    expect(hasPermission("MEMBER", "org:delete")).toBe(false);
    expect(hasPermission("MEMBER", "member:add")).toBe(false);
    expect(hasPermission("MEMBER", "ownership:transfer")).toBe(false);
  });

  it("ADMIN can manage members and rename, but not delete or grant ADMIN", () => {
    expect(hasPermission("ADMIN", "org:update")).toBe(true);
    expect(hasPermission("ADMIN", "member:add")).toBe(true);
    expect(hasPermission("ADMIN", "member:update:member")).toBe(true);
    expect(hasPermission("ADMIN", "member:remove:member")).toBe(true);
    expect(hasPermission("ADMIN", "org:delete")).toBe(false);
    expect(hasPermission("ADMIN", "member:add:admin")).toBe(false);
    expect(hasPermission("ADMIN", "member:update:admin")).toBe(false);
    expect(hasPermission("ADMIN", "member:remove:admin")).toBe(false);
    expect(hasPermission("ADMIN", "ownership:transfer")).toBe(false);
  });

  it("OWNER holds every permission", () => {
    for (const p of [
      "org:delete",
      "member:add:admin",
      "member:update:admin",
      "member:remove:admin",
      "ownership:transfer",
    ] as const) {
      expect(hasPermission("OWNER", p)).toBe(true);
    }
  });

  it("rank hierarchy: strictly-lower targets only", () => {
    expect(canActOn("OWNER", "ADMIN")).toBe(true);
    expect(canActOn("OWNER", "MEMBER")).toBe(true);
    expect(canActOn("ADMIN", "MEMBER")).toBe(true);
    expect(canActOn("ADMIN", "ADMIN")).toBe(false);
    expect(canActOn("ADMIN", "OWNER")).toBe(false);
    expect(canActOn("MEMBER", "MEMBER")).toBe(false);
    expect(canActOn("MEMBER", "ADMIN")).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Contracts / validation                                              */
/* ------------------------------------------------------------------ */

describe("contract validation", () => {
  it("slug schema accepts valid slugs and rejects bad ones", () => {
    expect(orgSlugSchema.safeParse("acme-corp").success).toBe(true);
    expect(orgSlugSchema.safeParse("ab").success).toBe(false); // <3 chars
    expect(orgSlugSchema.safeParse("-bad").success).toBe(false); // leading hyphen
    expect(orgSlugSchema.safeParse("bad-").success).toBe(false); // trailing hyphen
    expect(orgSlugSchema.safeParse("Bad Slug").success).toBe(false);
    expect(orgSlugSchema.safeParse("a".repeat(41)).success).toBe(false);
  });

  it("createOrg schema requires name >= 2 chars", () => {
    expect(createOrgSchema.safeParse({ name: "x", slug: "okslug" }).success).toBe(false);
    expect(createOrgSchema.safeParse({ name: "ok", slug: "okslug" }).success).toBe(true);
  });

  it("addMember schema never allows assigning OWNER directly", () => {
    expect(addMemberSchema.safeParse({ email: "a@b.co", role: "OWNER" }).success).toBe(false);
    expect(addMemberSchema.safeParse({ email: "a@b.co", role: "ADMIN" }).success).toBe(true);
    expect(addMemberSchema.safeParse({ email: "a@b.co", role: "MEMBER" }).success).toBe(true);
  });

  it("register schema enforces password minimum length", () => {
    expect(registerSchema.safeParse({ email: "a@b.co", name: "A", password: "1234567" }).success).toBe(false);
    expect(registerSchema.safeParse({ email: "a@b.co", name: "A", password: "12345678" }).success).toBe(true);
  });

  it("reserved slug list contains platform-critical paths", () => {
    for (const s of ["api", "admin", "app", "login", "register", "settings", "health"]) {
      expect(RESERVED_ORG_SLUGS.has(s)).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Organizations                                                       */
/* ------------------------------------------------------------------ */

describe("organizations", () => {
  it("create: creator becomes the single OWNER via transaction", async () => {
    const u = await createUser("founder");
    const created = await createOrganization(u.id, {
      name: "New Org",
      slug: uniqueSlug("new"),
    });
    const memberships = await db.membership.findMany({
      where: { organizationId: created.organization.id },
    });
    expect(memberships).toHaveLength(1);
    expect(memberships[0].role).toBe("OWNER");
    expect(memberships[0].userId).toBe(u.id);
    expect(created.role).toBe("OWNER");
  });

  it("create: duplicate slug -> CONFLICT", async () => {
    const u = await createUser("other");
    const err = await expectApiError(() =>
      createOrganization(u.id, { name: "Copy", slug })
    );
    expect(err.code).toBe("CONFLICT");
  });

  it("create: reserved slug -> CONFLICT", async () => {
    const u = await createUser("other");
    const err = await expectApiError(() =>
      createOrganization(u.id, { name: "Admin Org", slug: "admin" })
    );
    expect(err.code).toBe("CONFLICT");
  });

  it("list: returns only organizations the user belongs to", async () => {
    const mine = await listOrganizations(owner.id);
    expect(mine).toHaveLength(1);
    expect(mine[0].slug).toBe(slug);
    expect(mine[0].memberCount).toBe(3);
    const theirs = await listOrganizations(outsider.id);
    expect(theirs).toHaveLength(0);
  });

  it("rename: updates name, keeps slug", async () => {
    const renamed = await renameOrganization(orgId, "Renamed Org");
    expect(renamed.name).toBe("Renamed Org");
    expect(renamed.slug).toBe(slug);
  });

  it("delete: cascades memberships", async () => {
    await deleteOrganization(orgId);
    expect(await db.organization.findUnique({ where: { id: orgId } })).toBeNull();
    expect(
      await db.membership.count({ where: { organizationId: orgId } })
    ).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* Members                                                             */
/* ------------------------------------------------------------------ */

describe("members", () => {
  it("add: existing registered user joins with the requested role", async () => {
    const dto = await addMember(orgId, {
      email: outsider.email,
      role: "MEMBER",
    });
    expect(dto.user.id).toBe(outsider.id);
    expect(dto.role).toBe("MEMBER");
  });

  it("add: unknown email -> NOT_FOUND with guidance", async () => {
    const err = await expectApiError(() =>
      addMember(orgId, { email: "ghost@nowhere.test", role: "MEMBER" })
    );
    expect(err.code).toBe("NOT_FOUND");
  });

  it("add: duplicate membership -> CONFLICT", async () => {
    const err = await expectApiError(() =>
      addMember(orgId, { email: member.email, role: "MEMBER" })
    );
    expect(err.code).toBe("CONFLICT");
  });

  it("list: returns all members with user info", async () => {
    const members = await listMembers(orgId);
    expect(members).toHaveLength(3);
    const roles = members.map((m) => m.role).sort();
    expect(roles).toEqual(["ADMIN", "MEMBER", "OWNER"]);
  });
});

/* ------------------------------------------------------------------ */
/* Role updates                                                        */
/* ------------------------------------------------------------------ */

describe("role updates", () => {
  it("MEMBER cannot change any role", async () => {
    const err = await expectApiError(() =>
      updateMemberRole(opCtx(memberMembershipId, "MEMBER", adminMembershipId), {
        role: "MEMBER",
      })
    );
    expect(err.code).toBe("FORBIDDEN");
  });

  it("self role change is rejected (promotion requires ownership transfer)", async () => {
    const err = await expectApiError(() =>
      updateMemberRole(opCtx(adminMembershipId, "ADMIN", adminMembershipId), {
        role: "OWNER",
      })
    );
    expect(err.code).toBe("FORBIDDEN");
  });

  it("ADMIN cannot demote an ADMIN (rank rule)", async () => {
    const secondAdmin = await createUser("admin2");
    const secondAdminMembershipId = (
      await addMembership(secondAdmin.id, orgId, "ADMIN")
    ).id;
    const err = await expectApiError(() =>
      updateMemberRole(opCtx(adminMembershipId, "ADMIN", secondAdminMembershipId), {
        role: "MEMBER",
      })
    );
    expect(err.code).toBe("FORBIDDEN");
  });

  it("ADMIN cannot grant the ADMIN role (OWNER-only per matrix)", async () => {
    const err = await expectApiError(() =>
      updateMemberRole(opCtx(adminMembershipId, "ADMIN", memberMembershipId), {
        role: "ADMIN",
      })
    );
    expect(err.code).toBe("FORBIDDEN");
    expect(err.message).toMatch(/owner/i);
    // Target must be untouched.
    const target = await db.membership.findUnique({
      where: { id: memberMembershipId },
    });
    expect(target!.role).toBe("MEMBER");
  });

  it("ADMIN promoting a MEMBER to MEMBER is an idempotent no-op", async () => {
    const dto = await updateMemberRole(
      opCtx(adminMembershipId, "ADMIN", memberMembershipId),
      { role: "MEMBER" }
    );
    expect(dto.role).toBe("MEMBER");
  });

  it("OWNER can demote an ADMIN to MEMBER", async () => {
    const dto = await updateMemberRole(
      opCtx(ownerMembershipId, "OWNER", adminMembershipId),
      { role: "MEMBER" }
    );
    expect(dto.role).toBe("MEMBER");
  });

  it("OWNER can promote a MEMBER to ADMIN", async () => {
    const dto = await updateMemberRole(
      opCtx(ownerMembershipId, "OWNER", memberMembershipId),
      { role: "ADMIN" }
    );
    expect(dto.role).toBe("ADMIN");
  });

  it("cross-tenant membershipId is NOT_FOUND (no IDOR)", async () => {
    const otherOwner = await createUser("other-owner");
    const otherOrg = await createOrgWithOwner(otherOwner.id, uniqueSlug("other"));
    const victimId = (await addMembership(member.id, otherOrg.organization.id, "MEMBER")).id;

    // Owner of org A tries to change a membership of org B by raw ID.
    const err = await expectApiError(() =>
      updateMemberRole(
        { organizationId: orgId, actorMembershipId: ownerMembershipId, actorRole: "OWNER", membershipId: victimId },
        { role: "MEMBER" }
      )
    );
    expect(err.code).toBe("NOT_FOUND");
    // And the foreign membership is untouched.
    const victim = await db.membership.findUnique({ where: { id: victimId } });
    expect(victim!.role).toBe("MEMBER");
    expect(victim!.organizationId).toBe(otherOrg.organization.id);
  });
});

/* ------------------------------------------------------------------ */
/* Ownership transfer                                                  */
/* ------------------------------------------------------------------ */

describe("ownership transfer", () => {
  it("transfers ownership: actor -> ADMIN, target -> OWNER, single owner", async () => {
    const dto = await updateMemberRole(
      opCtx(ownerMembershipId, "OWNER", adminMembershipId),
      { role: "OWNER" }
    );
    expect(dto.role).toBe("OWNER");

    const roles = await db.membership.findMany({ where: { organizationId: orgId } });
    const owners = roles.filter((m) => m.role === "OWNER");
    expect(owners).toHaveLength(1);
    expect(owners[0].id).toBe(adminMembershipId);

    const exOwner = await db.membership.findUnique({ where: { id: ownerMembershipId } });
    expect(exOwner!.role).toBe("ADMIN");
  });

  it("non-owner cannot transfer ownership", async () => {
    const err = await expectApiError(() =>
      updateMemberRole(opCtx(adminMembershipId, "ADMIN", memberMembershipId), {
        role: "OWNER",
      })
    );
    expect(err.code).toBe("FORBIDDEN");
  });

  it("CONCURRENT transfers leave exactly one valid owner (race safety)", async () => {
    // The owner simultaneously hands ownership to admin and member.
    const results = await Promise.allSettled([
      updateMemberRole(opCtx(ownerMembershipId, "OWNER", adminMembershipId), { role: "OWNER" }),
      updateMemberRole(opCtx(ownerMembershipId, "OWNER", memberMembershipId), { role: "OWNER" }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter(
      (r) => r.status === "rejected" && (r.reason as { code?: string })?.code === "CONFLICT"
    );
    // At most one transfer may win.
    expect(fulfilled.length).toBeLessThanOrEqual(1);
    expect(fulfilled.length + rejected.length).toBe(2);

    // Invariant: exactly one OWNER remains in the organization.
    const roles = await db.membership.findMany({ where: { organizationId: orgId } });
    const owners = roles.filter((m) => m.role === "OWNER");
    expect(owners).toHaveLength(1);

    const winner = owners[0];
    expect(winner.id === adminMembershipId || winner.id === memberMembershipId).toBe(true);
    const exOwnerRow = await db.membership.findUnique({ where: { id: ownerMembershipId } });
    expect(exOwnerRow!.role).toBe("ADMIN");
  });

  it("transfer to a MEMBER then back maintains exactly one owner", async () => {
    await updateMemberRole(opCtx(ownerMembershipId, "OWNER", memberMembershipId), {
      role: "OWNER",
    });
    // New owner is the ex-member; transfer back to the original owner (now ADMIN).
    const newOwnerMembershipId = memberMembershipId;
    await updateMemberRole(
      { organizationId: orgId, actorMembershipId: newOwnerMembershipId, actorRole: "OWNER", membershipId: ownerMembershipId },
      { role: "OWNER" }
    );
    const roles = await db.membership.findMany({ where: { organizationId: orgId } });
    const owners = roles.filter((m) => m.role === "OWNER");
    expect(owners).toHaveLength(1);
    expect(owners[0].id).toBe(ownerMembershipId);
  });
});

/* ------------------------------------------------------------------ */
/* Member removal                                                      */
/* ------------------------------------------------------------------ */

describe("member removal", () => {
  it("OWNER is unremovable", async () => {
    const err = await expectApiError(() =>
      removeMember(opCtx(ownerMembershipId, "OWNER", ownerMembershipId))
    );
    expect(err.code).toBe("FORBIDDEN");
  });

  it("self-removal is rejected", async () => {
    const err = await expectApiError(() =>
      removeMember(opCtx(adminMembershipId, "ADMIN", adminMembershipId))
    );
    expect(err.code).toBe("FORBIDDEN");
  });

  it("MEMBER cannot remove anyone", async () => {
    const err = await expectApiError(() =>
      removeMember(opCtx(memberMembershipId, "MEMBER", adminMembershipId))
    );
    expect(err.code).toBe("FORBIDDEN");
  });

  it("ADMIN can remove a MEMBER", async () => {
    await removeMember(opCtx(adminMembershipId, "ADMIN", memberMembershipId));
    expect(
      await db.membership.findUnique({ where: { id: memberMembershipId } })
    ).toBeNull();
  });

  it("ADMIN cannot remove an ADMIN (rank rule)", async () => {
    const secondAdmin = await createUser("admin3");
    const secondAdminId = (await addMembership(secondAdmin.id, orgId, "ADMIN")).id;
    const err = await expectApiError(() =>
      removeMember(opCtx(adminMembershipId, "ADMIN", secondAdminId))
    );
    expect(err.code).toBe("FORBIDDEN");
  });

  it("OWNER can remove an ADMIN", async () => {
    await removeMember(opCtx(ownerMembershipId, "OWNER", adminMembershipId));
    expect(
      await db.membership.findUnique({ where: { id: adminMembershipId } })
    ).toBeNull();
  });

  it("cross-tenant removal by raw ID is NOT_FOUND", async () => {
    const otherOwner = await createUser("other-owner2");
    const otherOrg = await createOrgWithOwner(otherOwner.id, uniqueSlug("other2"));
    const victimId = (await addMembership(member.id, otherOrg.organization.id, "MEMBER")).id;
    const err = await expectApiError(() =>
      removeMember({
        organizationId: orgId,
        actorMembershipId: ownerMembershipId,
        actorRole: "OWNER",
        membershipId: victimId,
      })
    );
    expect(err.code).toBe("NOT_FOUND");
    expect(await db.membership.findUnique({ where: { id: victimId } })).not.toBeNull();
  });
});
