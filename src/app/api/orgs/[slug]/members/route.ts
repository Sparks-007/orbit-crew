import { NextResponse, type NextRequest } from "next/server";
import { handleRoute, parseJsonBody } from "@/lib/api/handler";
import { assertSameOrigin } from "@/lib/api/request";
import { rateLimit } from "@/lib/api/rate-limit";
import { addMemberSchema } from "@/lib/contracts/api";
import { requireOrgContext } from "@/lib/auth/guards";
import { addMember, listMembers } from "@/lib/orgs/service";

type RouteParams = { params: Promise<{ slug: string }> };

/**
 * GET /api/orgs/[slug]/members — list members. Requires member:read (any member).
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  return handleRoute(async () => {
    const { slug } = await params;
    const ctx = await requireOrgContext(req, slug, "member:read");
    const members = await listMembers(ctx.organization.id);
    return NextResponse.json({ members });
  });
}

/**
 * POST /api/orgs/[slug]/members — add a member by email of an existing
 * registered user. MEMBER grants require member:add (ADMIN+); ADMIN grants
 * require member:add:admin (OWNER). Owner cannot be added directly —
 * ownership transfers through the role-update endpoint.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  return handleRoute(async () => {
    assertSameOrigin(req);
    const { slug } = await params;
    const input = await parseJsonBody(req, addMemberSchema);

    const permission =
      input.role === "ADMIN" ? "member:add:admin" : ("member:add" as const);
    const ctx = await requireOrgContext(req, slug, permission);

    rateLimit(`member-add:user:${ctx.auth.user.id}`, 30, 60 * 60 * 1000);

    const member = await addMember(ctx.organization.id, input);
    return NextResponse.json({ member }, { status: 201 });
  });
}
