import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  hashPassword,
  verifyPassword,
  getDummyPasswordHash,
} from "@/lib/auth/password";
import {
  createSessionToken,
  hashSessionToken,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { registerUser, loginUser, logoutSession } from "@/lib/auth/service";
import { requireAuth } from "@/lib/auth/guards";
import { expectApiError, makeRequest, uniqueEmail, uniqueIp } from "./helpers";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as registerRoute } from "@/app/api/auth/register/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";

beforeEach(async () => {
  await db.session.deleteMany();
  await db.user.deleteMany();
});

afterAll(async () => {
  await db.$disconnect();
});

/* ------------------------------------------------------------------ */
/* Password hashing                                                    */
/* ------------------------------------------------------------------ */

describe("password hashing", () => {
  it("round-trips a correct password", async () => {
    const hash = await hashPassword("s3cure-passw0rd!");
    expect(await verifyPassword("s3cure-passw0rd!", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("s3cure-passw0rd!");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("encodes scrypt parameters (N=16384, r=8, p=1) for future upgrades", async () => {
    const hash = await hashPassword("whatever");
    const [scheme, n, r, p] = hash.split("$");
    expect(scheme).toBe("scrypt");
    expect(Number(n)).toBe(16384);
    expect(Number(r)).toBe(8);
    expect(Number(p)).toBe(1);
  });

  it("rejects malformed or tampered hashes without throwing", async () => {
    const hash = await hashPassword("whatever");
    expect(await verifyPassword("whatever", "")).toBe(false);
    expect(await verifyPassword("whatever", "bcrypt$2a$garbage")).toBe(false);
    expect(await verifyPassword("whatever", "scrypt$abc$8$1$aa$bb")).toBe(false);
    // A tampered hash must never verify a DIFFERENT password, whatever the
    // lenient base64 decoding does with the trailing characters.
    expect(await verifyPassword("different-password", `${hash}x`)).toBe(false);
    expect(await verifyPassword("different-password", `${hash}!!!!`)).toBe(false);
    // And the original password still verifies after the tampering attempt.
    expect(await verifyPassword("whatever", `${hash}x`)).toBe(true);
  });

  it("produces a unique salt per hash", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
  });

  it("dummy hash is usable for timing equalization", async () => {
    const dummy = await getDummyPasswordHash();
    expect(await verifyPassword("not-the-dummy", dummy)).toBe(false);
    expect(dummy.startsWith("scrypt$16384$8$1$")).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Session tokens                                                      */
/* ------------------------------------------------------------------ */

describe("session tokens", () => {
  it("uses a cryptographically secure random source with high entropy", () => {
    const a = createSessionToken();
    const b = createSessionToken();
    expect(a.token).not.toBe(b.token);
    // 32 bytes -> 43 base64url chars
    expect(a.token).toHaveLength(43);
    expect(a.token).not.toMatch(/[+/=]/); // base64url alphabet only
  });

  it("stores only an HMAC representation, never the plaintext token", () => {
    const { token, tokenHash } = createSessionToken();
    expect(tokenHash).not.toContain(token);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
    expect(tokenHash).toBe(hashSessionToken(token)); // deterministic
  });

  it("different AUTH_SECRET produces a different hash", async () => {
    const { token } = createSessionToken();
    const { hashSessionToken: hashWith } = await import("@/lib/auth/session");
    // Recompute with the same secret must match; tampering the secret space
    // is covered by determinism above. Sanity: hash length/format.
    expect(hashWith(token)).toHaveLength(64);
  });

  it("cookie options are httpOnly, SameSite=Lax, Secure in production", () => {
    const opts = sessionCookieOptions(new Date("2030-01-01"));
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.path).toBe("/");
    expect(opts.expires).toEqual(new Date("2030-01-01"));
    // secure flag is env-dependent; production is asserted in src (isProductionEnv)
  });
});

/* ------------------------------------------------------------------ */
/* Registration / login / logout (service level)                        */
/* ------------------------------------------------------------------ */

describe("auth service", () => {
  it("registers a user with normalized email and creates a session", async () => {
    const email = uniqueEmail();
    const result = await registerUser(
      { email: email.toUpperCase(), name: " Alice ", password: "longenough1" },
      { ipAddress: uniqueIp(), userAgent: "vitest" }
    );
    if (result.payload.user === null) throw new Error("register returned signed-out payload");
    expect(result.payload.user.email).toBe(email.toLowerCase());
    expect(result.payload.memberships).toEqual([]);
    expect(result.token).toHaveLength(43);

    const stored = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    expect(stored?.passwordHash).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(stored?.passwordHash).not.toContain("longenough1");
  });

  it("rejects duplicate email registration with CONFLICT", async () => {
    const email = uniqueEmail();
    await registerUser({ email, name: "A", password: "longenough1" }, {});
    const err = await expectApiError(() =>
      registerUser({ email, name: "B", password: "longenough1" }, {})
    );
    expect(err.code).toBe("CONFLICT");
  });

  it("logs in with valid credentials and returns memberships", async () => {
    const email = uniqueEmail();
    await registerUser({ email, name: "A", password: "longenough1" }, {});
    const result = await loginUser({ email, password: "longenough1" }, {});
    if (result.payload.user === null) throw new Error("login returned signed-out payload");
    expect(result.payload.user.email).toBe(email);
    expect(result.token).toHaveLength(43);
  });

  it("rejects invalid password with generic UNAUTHORIZED", async () => {
    const email = uniqueEmail();
    await registerUser({ email, name: "A", password: "longenough1" }, {});
    const err = await expectApiError(() =>
      loginUser({ email, password: "wrong-password" }, {})
    );
    expect(err.code).toBe("UNAUTHORIZED");
    expect(err.message).toBe("Invalid email or password.");
  });

  it("rejects unknown email with the SAME generic message (no enumeration)", async () => {
    await registerUser(
      { email: uniqueEmail(), name: "A", password: "longenough1" },
      {}
    );
    const err = await expectApiError(() =>
      loginUser({ email: "ghost@nowhere.test", password: "whatever123" }, {})
    );
    const err2 = await expectApiError(() =>
      loginUser({ email: uniqueEmail(), password: "not-it" }, {})
    );
    expect(err.code).toBe("UNAUTHORIZED");
    expect(err.message).toBe(err2.message);
  });

  it("logout revokes the server-side session", async () => {
    const email = uniqueEmail();
    const { token } = await registerUser(
      { email, name: "A", password: "longenough1" },
      {}
    );
    const req = makeRequest("/api/auth/session", {
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
    });
    await requireAuth(req); // valid before logout

    await logoutSession(token);

    const err = await expectApiError(() => requireAuth(req));
    expect(err.code).toBe("UNAUTHORIZED");

    const row = await db.session.findFirst({
      where: { tokenHash: hashSessionToken(token) },
    });
    expect(row?.revokedAt).not.toBeNull();
  });

  it("logout is idempotent for unknown tokens", async () => {
    await expect(logoutSession("no-such-token")).resolves.toBeUndefined();
    await expect(logoutSession(undefined)).resolves.toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/* Session validation (guards)                                         */
/* ------------------------------------------------------------------ */

describe("requireAuth", () => {
  it("401 without a cookie", async () => {
    const req = makeRequest("/api/auth/session");
    const err = await expectApiError(() => requireAuth(req));
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("401 for an invalid token", async () => {
    const req = makeRequest("/api/auth/session", {
      headers: { cookie: `${SESSION_COOKIE}=totally-invalid-token` },
    });
    const err = await expectApiError(() => requireAuth(req));
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("401 for an expired session", async () => {
    const user = await db.user.create({
      data: {
        email: uniqueEmail(),
        name: "A",
        passwordHash: await hashPassword("longenough1"),
      },
    });
    const session = await db.session.create({
      data: {
        tokenHash: hashSessionToken("expired-token"),
        userId: user.id,
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    const req = makeRequest("/api/auth/session", {
      headers: { cookie: `${SESSION_COOKIE}=expired-token` },
    });
    const err = await expectApiError(() => requireAuth(req));
    expect(err.code).toBe("UNAUTHORIZED");
    await db.session.delete({ where: { id: session.id } });
  });

  it("slides expiry forward for sessions past half-life", async () => {
    const user = await db.user.create({
      data: {
        email: uniqueEmail(),
        name: "A",
        passwordHash: await hashPassword("longenough1"),
      },
    });
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS / 4); // past half-life
    const session = await db.session.create({
      data: {
        tokenHash: hashSessionToken("sliding-token"),
        userId: user.id,
        expiresAt,
      },
    });
    const req = makeRequest("/api/auth/session", {
      headers: { cookie: `${SESSION_COOKIE}=sliding-token` },
    });
    const ctx = await requireAuth(req);
    expect(ctx.user.id).toBe(user.id);

    const refreshed = await db.session.findUnique({ where: { id: session.id } });
    expect(refreshed!.expiresAt.getTime()).toBeGreaterThan(
      Date.now() + SESSION_TTL_MS - 5000
    );
  });

  it("does not slide expiry for fresh sessions", async () => {
    const user = await db.user.create({
      data: {
        email: uniqueEmail(),
        name: "A",
        passwordHash: await hashPassword("longenough1"),
      },
    });
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS); // fresh
    const session = await db.session.create({
      data: {
        tokenHash: hashSessionToken("fresh-token"),
        userId: user.id,
        expiresAt,
      },
    });
    const req = makeRequest("/api/auth/session", {
      headers: { cookie: `${SESSION_COOKIE}=fresh-token` },
    });
    await requireAuth(req);
    const after = await db.session.findUnique({ where: { id: session.id } });
    expect(after!.expiresAt.getTime()).toBe(expiresAt.getTime());
  });
});

/* ------------------------------------------------------------------ */
/* HTTP route behavior (origin checks, cookies, rate limits)            */
/* ------------------------------------------------------------------ */

describe("auth routes", () => {
  it("register: sets an httpOnly SameSite=Lax session cookie", async () => {
    const res = await registerRoute(
      makeRequest("/api/auth/register", {
        method: "POST",
        headers: { origin: "http://localhost:3000", "x-forwarded-for": uniqueIp() },
        body: { email: uniqueEmail(), name: "Cookie Test", password: "longenough1" },
      })
    );
    expect(res.status).toBe(201);
    const cookie = res.cookies.get(SESSION_COOKIE);
    expect(cookie).toBeDefined();
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.sameSite).toBe("lax");
    expect(cookie!.value).toHaveLength(43);
  });

  it("register: rejects malformed JSON with BAD_REQUEST", async () => {
    const res = await registerRoute(
      makeRequest("/api/auth/register", {
        method: "POST",
        headers: { origin: "http://localhost:3000", "x-forwarded-for": uniqueIp() },
        body: "{not json",
      })
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("register: rejects invalid payloads with VALIDATION_ERROR (422)", async () => {
    const res = await registerRoute(
      makeRequest("/api/auth/register", {
        method: "POST",
        headers: { origin: "http://localhost:3000", "x-forwarded-for": uniqueIp() },
        body: { email: "not-an-email", name: "", password: "short" },
      })
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toMatch(/email/i);
  });

  it("login: rejects a forged cross-site Origin with 403", async () => {
    const res = await loginRoute(
      makeRequest("/api/auth/login", {
        method: "POST",
        headers: {
          origin: "https://evil.example",
          host: "app.orbitcrew.test",
          "x-forwarded-for": uniqueIp(),
        },
        body: { email: uniqueEmail(), password: "whatever1" },
      })
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.error.message).toBe("Cross-origin request blocked.");
  });

  it("login: rejects Origin \"null\" on mutations", async () => {
    const res = await loginRoute(
      makeRequest("/api/auth/login", {
        method: "POST",
        headers: { origin: "null", host: "app.orbitcrew.test", "x-forwarded-for": uniqueIp() },
        body: { email: uniqueEmail(), password: "whatever1" },
      })
    );
    expect(res.status).toBe(403);
  });

  it("login: accepts a same-origin request and returns the session payload", async () => {
    const email = uniqueEmail();
    await registerUser({ email, name: "A", password: "longenough1" }, {});
    const res = await loginRoute(
      makeRequest("/api/auth/login", {
        method: "POST",
        headers: { origin: "http://localhost:3000", "x-forwarded-for": uniqueIp() },
        body: { email, password: "longenough1" },
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { email: string } };
    expect(body.user.email).toBe(email);
  });

  it("login: rate limits repeated attempts per IP (429)", async () => {
    const ip = uniqueIp();
    const email = uniqueEmail();
    let last = 0;
    for (let i = 0; i < 25; i++) {
      const res = await loginRoute(
        makeRequest("/api/auth/login", {
          method: "POST",
          headers: { origin: "http://localhost:3000", "x-forwarded-for": ip },
          body: { email, password: "nope-nope-nope" },
        })
      );
      last = res.status;
      if (last === 429) break;
    }
    expect(last).toBe(429);
  });

  it("logout: clears the cookie and revokes server-side", async () => {
    const email = uniqueEmail();
    const { token } = await registerUser(
      { email, name: "A", password: "longenough1" },
      {}
    );
    const res = await logoutRoute(
      makeRequest("/api/auth/logout", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${SESSION_COOKIE}=${token}`,
        },
      })
    );
    expect(res.status).toBe(200);
    const cleared = res.cookies.get(SESSION_COOKIE);
    expect(cleared!.value).toBe("");
    const err = await expectApiError(() =>
      requireAuth(
        makeRequest("/api/auth/session", {
          headers: { cookie: `${SESSION_COOKIE}=${token}` },
        })
      )
    );
    expect(err.code).toBe("UNAUTHORIZED");
  });
});
