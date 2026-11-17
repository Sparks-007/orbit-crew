import { NextResponse, type NextRequest } from "next/server";
import { handleRoute } from "@/lib/api/handler";
import { requireAuth } from "@/lib/auth/guards";
import { listMembershipSummaries } from "@/lib/auth/service";

/**
 * GET /api/auth/session — current identity + organization memberships.
 * Returns 401 with the standard error envelope when signed out; the client
 * treats 401 as the signed-out state (never an error banner).
 */
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    const auth = await requireAuth(req);
    const memberships = await listMembershipSummaries(auth.user.id);
    return NextResponse.json({ user: auth.user, memberships });
  });
}
