import { NextResponse, type NextRequest } from "next/server";
import { handleRoute } from "@/lib/api/handler";
import { assertSameOrigin } from "@/lib/api/request";
import { logoutSession } from "@/lib/auth/service";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

/**
 * POST /api/auth/logout — revoke the server-side session and clear the cookie.
 * Idempotent: works even when the session is already invalid.
 */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    assertSameOrigin(req);
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    await logoutSession(token);

    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(new Date(0)));
    return res;
  });
}
