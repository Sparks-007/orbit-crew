import { NextResponse, type NextRequest } from "next/server";
import { handleRoute, parseJsonBody } from "@/lib/api/handler";
import { assertSameOrigin } from "@/lib/api/request";
import { updateMemberRoleSchema } from "@/lib/contracts/api";
import { requireOrgContext } from "@/lib/auth/guards";
import { removeMember, updateMemberRole } from "@/lib/orgs/service";

type RouteParams = { params: Promise<{ slug: string; membershipId: string }> };

/**
 * PATCH /api/orgs/[slug]/members/[membershipId] — change a member's role.
 * Role-targeted permission checks run inside the service (owner transfer,
 * rank hierarchy, self-change guards). All lookups are organization-scoped.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  return handleRoute(async () => {
    assertSameOrigin(req);
    const { slug, membershipId } = await params;
    const ctx = await requireOrgContext(req, slug, "member:read");
    const input = await parseJsonBody(req, updateMemberRoleSchema);

    const member = await updateMemberRole(
      {
        organizationId: ctx.organization.id,
        actorMembershipId: ctx.membership.id,
        actorRole: ctx.membership.role,
        membershipId,
      },
      input
    );
    return NextResponse.json({ member });
  });
}

/**
 * DELETE /api/orgs/[slug]/members/[membershipId] — remove a member.
 * Owner cannot be removed; rank hierarchy enforced server-side.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  return handleRoute(async () => {
    assertSameOrigin(req);
    const { slug, membershipId } = await params;
    const ctx = await requireOrgContext(req, slug, "member:read");

    await removeMember({
      organizationId: ctx.organization.id,
      actorMembershipId: ctx.membership.id,
      actorRole: ctx.membership.role,
      membershipId,
    });
    return NextResponse.json({ ok: true });
  });
}
