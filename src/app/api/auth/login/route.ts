import { NextResponse, type NextRequest } from "next/server";
import { handleRoute, parseJsonBody } from "@/lib/api/handler";
import { assertSameOrigin, getClientIp } from "@/lib/api/request";
import { rateLimit } from "@/lib/api/rate-limit";
import { loginSchema } from "@/lib/contracts/api";
import { loginUser } from "@/lib/auth/service";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

/**
 * POST /api/auth/login — verify credentials and start a session.
 * Rate limited per IP and per email. Generic error messages prevent
 * account enumeration.
 */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    assertSameOrigin(req);
    const ip = getClientIp(req);
    rateLimit(`login:ip:${ip}`, 20, 10 * 60 * 1000);

    const input = await parseJsonBody(req, loginSchema);
    rateLimit(
      `login:email:${input.email.trim().toLowerCase()}`,
      10,
      10 * 60 * 1000
    );

    const { payload, token, expiresAt } = await loginUser(input, {
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });

    const res = NextResponse.json(payload);
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    return res;
  });
}
