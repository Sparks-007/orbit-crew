import { NextResponse, type NextRequest } from "next/server";
import { handleRoute, parseJsonBody } from "@/lib/api/handler";
import { assertSameOrigin } from "@/lib/api/request";
import { renameOrgSchema } from "@/lib/contracts/api";
import { requireOrgContext } from "@/lib/auth/guards";
import {
  deleteOrganization,
  listMembers,
  renameOrganization,
} from "@/lib/orgs/service";

type RouteParams = { params: Promise<{ slug: string }> };

/**
 * GET /api/orgs/[slug] — organization detail + members.
 * Requires membership (org:read). Non-members get 404 (no existence leak).
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  return handleRoute(async () => {
    const { slug } = await params;
    const ctx = await requireOrgContext(req, slug, "org:read");
    const members = await listMembers(ctx.organization.id);
    return NextResponse.json({
      organization: {
        id: ctx.organization.id,
        name: ctx.organization.name,
        slug: ctx.organization.slug,
        createdAt: ctx.organization.createdAt.toISOString(),
      },
      membership: { role: ctx.membership.role },
      members,
    });
  });
}

/**
 * PATCH /api/orgs/[slug] — rename the organization. Requires org:update (ADMIN+).
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  return handleRoute(async () => {
    assertSameOrigin(req);
    const { slug } = await params;
    const ctx = await requireOrgContext(req, slug, "org:update");
    const input = await parseJsonBody(req, renameOrgSchema);
    const organization = await renameOrganization(
      ctx.organization.id,
      input.name
    );
    return NextResponse.json({ organization });
  });
}

/**
 * DELETE /api/orgs/[slug] — delete the organization. Requires org:delete (OWNER).
 * Memberships cascade-delete with the organization.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  return handleRoute(async () => {
    assertSameOrigin(req);
    const { slug } = await params;
    const ctx = await requireOrgContext(req, slug, "org:delete");
    await deleteOrganization(ctx.organization.id);
    return NextResponse.json({ ok: true });
  });
}
