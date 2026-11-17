import { NextResponse, type NextRequest } from "next/server";
import { handleRoute, parseJsonBody } from "@/lib/api/handler";
import { assertSameOrigin } from "@/lib/api/request";
import { rateLimit } from "@/lib/api/rate-limit";
import { createOrgSchema } from "@/lib/contracts/api";
import { requireAuth } from "@/lib/auth/guards";
import { createOrganization, listOrganizations } from "@/lib/orgs/service";

/**
 * GET /api/orgs — organizations the authenticated user belongs to.
 */
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    const auth = await requireAuth(req);
    const organizations = await listOrganizations(auth.user.id);
    return NextResponse.json({ organizations });
  });
}

/**
 * POST /api/orgs — create an organization; the creator becomes OWNER.
 * The slug is validated against the shared contract and a reserved-word
 * list; uniqueness is enforced at the database level.
 */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    assertSameOrigin(req);
    const auth = await requireAuth(req);
    rateLimit(`org-create:user:${auth.user.id}`, 10, 60 * 60 * 1000);

    const input = await parseJsonBody(req, createOrgSchema);
    const created = await createOrganization(auth.user.id, input);
    return NextResponse.json(created, { status: 201 });
  });
}
