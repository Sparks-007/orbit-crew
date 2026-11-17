import { NextResponse, type NextRequest } from "next/server";
import { handleRoute, parseJsonBody } from "@/lib/api/handler";
import { assertSameOrigin, getClientIp } from "@/lib/api/request";
import { rateLimit } from "@/lib/api/rate-limit";
import { registerSchema } from "@/lib/contracts/api";
import { registerUser } from "@/lib/auth/service";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

/**
 * POST /api/auth/register — create an account and start a session.
 * Rate limited per IP. Sets the session cookie (httpOnly, SameSite=Lax).
 */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    assertSameOrigin(req);
    const ip = getClientIp(req);
    rateLimit(`register:ip:${ip}`, 5, 60 * 60 * 1000);

    const input = await parseJsonBody(req, registerSchema);
    const { payload, token, expiresAt } = await registerUser(input, {
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });

    const res = NextResponse.json(payload, { status: 201 });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    return res;
  });
}
