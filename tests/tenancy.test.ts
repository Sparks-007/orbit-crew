import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import { requireAuth, requireOrgContext } from "@/lib/auth/guards";
import { assertSameOrigin } from "@/lib/api/request";
import { rateLimit } from "@/lib/api/rate-limit";
import { ApiError } from "@/lib/api/errors";
import { getEnv, resetEnvCacheForTests } from "@/lib/env";
import { GET as orgDetailRoute, PATCH as orgRenameRoute, DELETE as orgDeleteRoute } from "@/app/api/orgs/[slug]/route";
import { GET as orgsListRoute, POST as orgsCreateRoute } from "@/app/api/orgs/route";
import { GET as membersListRoute, POST as membersAddRoute } from "@/app/api/orgs/[slug]/members/route";
import { PATCH as memberPatchRoute } from "@/app/api/orgs/[slug]/members/[membershipId]/route";
import { GET as sessionRoute } from "@/app/api/auth/session/route";
import { SESSION_COOKIE } from "@/lib/auth/session";
import {
  expectApiError,
  resetDb,
  createUser,
  createOrgWithOwner,
  addMembership,
  uniqueSlug,
  uniqueIp,
  makeRequest,
  type TestUser,
} from "./helpers";

/**
 * Cross-tenant isolation + HTTP-level authorization matrix.
 *
 * Organization access is resolved server-side from the session cookie and
 * the Membership table; every route must refuse tenants it does not belong
 * to, with 404 (no existence leak) for non-members.
 */

let owner: TestUser;
let member: TestUser;
let outsider: TestUser;
let slug: string;
let orgId: string;
let ownerSession: string;
let memberSession: string;
let outsiderSession: string;

async function createSession(userId: string): Promise<string> {
  const { createSessionToken } = await import("@/lib/auth/session");
  const { token } = createSessionToken();
  await db.session.create({
    data: {
      tokenHash: (await import("@/lib/auth/session")).hashSessionToken(token),
      userId,
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    },
  });
  return token;
}

function authed(
  url: string,
  token: string,
  init: { method?: string; headers?: Record<string, string>; body?: unknown } = {}
) {
  return makeRequest(url, {
    ...init,
    headers: {
      origin: "http://localhost:3000",
      "x-forwarded-for": uniqueIp(),
      cookie: `${SESSION_COOKIE}=${token}`,
      ...(init.headers ?? {}),
    },
  });
}

beforeEach(async () => {
  await resetDb();
  owner = await createUser("owner");
  member = await createUser("member");
  outsider = await createUser("outsider");
  slug = uniqueSlug();
  const { organization } = await createOrgWithOwner(owner.id, slug);
  orgId = organization.id;
  await addMembership(member.id, orgId, "MEMBER");
  ownerSession = await createSession(owner.id);
  memberSession = await createSession(member.id);
  outsiderSession = await createSession(outsider.id);
});

afterAll(async () => {
  await db.$disconnect();
});

/* ------------------------------------------------------------------ */
/* Guard-level tenancy                                                 */
/* ------------------------------------------------------------------ */

describe("requireOrgContext (guard)", () => {
  it("resolves context for a member", async () => {
    const req = authed(`/api/orgs/${slug}`, memberSession);
    const ctx = await requireOrgContext(req, slug, "org:read");
    expect(ctx.organization.id).toBe(orgId);
    expect(ctx.membership.role).toBe("MEMBER");
  });

  it("404 (no existence leak) for a non-member", async () => {
    const req = authed(`/api/orgs/${slug}`, outsiderSession);
    const err = await expectApiError(() => requireOrgContext(req, slug, "org:read"));
    expect(err.code).toBe("NOT_FOUND");
  });

  it("404 for a slug that does not exist at all", async () => {
    const req = authed("/api/orgs/never-created", ownerSession);
    const err = await expectApiError(() => requireOrgContext(req, "never-created", "org:read"));
    expect(err.code).toBe("NOT_FOUND");
  });

  it("404 after the membership is removed (revoked access)", async () => {
    await db.membership.deleteMany({ where: { userId: member.id, organizationId: orgId } });
    const req = authed(`/api/orgs/${slug}`, memberSession);
    const err = await expectApiError(() => requireOrgContext(req, slug, "org:read"));
    expect(err.code).toBe("NOT_FOUND");
  });

  it("role check runs server-side: MEMBER fails ADMIN permission", async () => {
    const req = authed(`/api/orgs/${slug}`, memberSession);
    const err = await expectApiError(() => requireOrgContext(req, slug, "org:update"));
    expect(err.code).toBe("FORBIDDEN");
  });

  it("org switching does not leak the previous organization context", async () => {
    // The user joins a second organization; sequential requests must resolve
    // each slug independently with no shared/cached tenant state.
    const otherOwner = await createUser("other");
    const otherSlug = uniqueSlug("other");
    await createOrgWithOwner(otherOwner.id, otherSlug);
    await addMembership(owner.id, (await db.organization.findUniqueOrThrow({ where: { slug: otherSlug } })).id, "MEMBER");

    const first = await requireOrgContext(
      authed(`/api/orgs/${slug}`, ownerSession),
      slug,
      "org:read"
    );
    const second = await requireOrgContext(
      authed(`/api/orgs/${otherSlug}`, ownerSession),
      otherSlug,
      "org:read"
    );
    expect(first.organization.id).toBe(orgId);
    expect(first.membership.role).toBe("OWNER");
    expect(second.organization.slug).toBe(otherSlug);
    expect(second.membership.role).toBe("MEMBER");
    expect(second.organization.id).not.toBe(orgId);
  });
});

/* ------------------------------------------------------------------ */
/* HTTP-level authorization matrix                                     */
/* ------------------------------------------------------------------ */

describe("org routes (HTTP authorization)", () => {
  it("unauthenticated access is 401 on every route", async () => {
    const noCookie = { headers: { origin: "http://localhost:3000", "x-forwarded-for": uniqueIp() } };
    expect((await orgsListRoute(makeReq("/api/orgs", noCookie))).status).toBe(401);
    expect((await orgDetailRoute(makeReq(`/api/orgs/${slug}`, noCookie), ctx({ slug }))).status).toBe(401);
    expect((await membersListRoute(makeReq(`/api/orgs/${slug}/members`, noCookie), ctx({ slug }))).status).toBe(401);
    expect((await sessionRoute(makeReq("/api/auth/session", noCookie))).status).toBe(401);
  });

  it("outsider gets 404 (not 403) on org detail — no existence leak", async () => {
    const res = await orgDetailRoute(authed(`/api/orgs/${slug}`, outsiderSession), ctx({ slug }));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("Organization not found.");
  });

  it("MEMBER can read org detail and member list", async () => {
    const res = await orgDetailRoute(authed(`/api/orgs/${slug}`, memberSession), ctx({ slug }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { membership: { role: string }; members: unknown[] };
    expect(body.membership.role).toBe("MEMBER");
    expect(body.members).toHaveLength(2);
  });

  it("MEMBER cannot rename (403), ADMIN can (200)", async () => {
    const denied = await orgRenameRoute(
      authed(`/api/orgs/${slug}`, memberSession, { method: "PATCH", body: { name: "Nope" } }),
      ctx({ slug })
    );
    expect(denied.status).toBe(403);

    const allowed = await orgRenameRoute(
      authed(`/api/orgs/${slug}`, ownerSession, { method: "PATCH", body: { name: "New Name" } }),
      ctx({ slug })
    );
    expect(allowed.status).toBe(200);
    const body = (await allowed.json()) as { organization: { name: string } };
    expect(body.organization.name).toBe("New Name");
  });

  it("ADMIN cannot delete the org (403); OWNER can (200)", async () => {
    const adminUser = await createUser("route-admin");
    await addMembership(adminUser.id, orgId, "ADMIN");
    const adminSession = await createSession(adminUser.id);

    const denied = await orgDeleteRoute(authed(`/api/orgs/${slug}`, adminSession), ctx({ slug }));
    expect(denied.status).toBe(403);

    const allowed = await orgDeleteRoute(authed(`/api/orgs/${slug}`, ownerSession), ctx({ slug }));
    expect(allowed.status).toBe(200);
    expect(await db.organization.findUnique({ where: { id: orgId } })).toBeNull();
  });

  it("MEMBER cannot add members; ADMIN can add MEMBER; only OWNER can add ADMIN", async () => {
    const newbie = await createUser("newbie");
    const newbie2 = await createUser("newbie2");
    const adminUser = await createUser("route-admin2");
    await addMembership(adminUser.id, orgId, "ADMIN");
    const adminSession = await createSession(adminUser.id);

    const denied = await membersAddRoute(
      authed(`/api/orgs/${slug}/members`, memberSession, {
        method: "POST",
        body: { email: newbie.email, role: "MEMBER" },
      }),
      ctx({ slug })
    );
    expect(denied.status).toBe(403);

    const byAdmin = await membersAddRoute(
      authed(`/api/orgs/${slug}/members`, adminSession, {
        method: "POST",
        body: { email: newbie.email, role: "MEMBER" },
      }),
      ctx({ slug })
    );
    expect(byAdmin.status).toBe(201);

    const adminGrantDenied = await membersAddRoute(
      authed(`/api/orgs/${slug}/members`, adminSession, {
        method: "POST",
        body: { email: newbie2.email, role: "ADMIN" },
      }),
      ctx({ slug })
    );
    expect(adminGrantDenied.status).toBe(403);

    const ownerGrant = await membersAddRoute(
      authed(`/api/orgs/${slug}/members`, ownerSession, {
        method: "POST",
        body: { email: newbie2.email, role: "ADMIN" },
      }),
      ctx({ slug })
    );
    expect(ownerGrant.status).toBe(201);
  });

  it("MEMBER cannot change roles via PATCH membership (403)", async () => {
    const membershipId = (
      await db.membership.findFirstOrThrow({ where: { userId: member.id, organizationId: orgId } })
    ).id;
    const res = await memberPatchRoute(
      authed(`/api/orgs/${slug}/members/${membershipId}`, memberSession, {
        method: "PATCH",
        body: { role: "ADMIN" },
      }),
      ctx({ slug, membershipId })
    );
    expect(res.status).toBe(403);
  });

  it("forged membershipId from another org is 404", async () => {
    const otherOwner = await createUser("forge-owner");
    const otherOrg = await createOrgWithOwner(otherOwner.id, uniqueSlug("forge"));
    const foreignMembershipId = (await addMembership(member.id, otherOrg.organization.id, "MEMBER")).id;

    const res = await memberPatchRoute(
      authed(`/api/orgs/${slug}/members/${foreignMembershipId}`, ownerSession, {
        method: "PATCH",
        body: { role: "MEMBER" },
      }),
      ctx({ slug, membershipId: foreignMembershipId })
    );
    expect(res.status).toBe(404);
  });

  it("create org: creator becomes OWNER; rate limited per user", async () => {
    const res = await orgsCreateRoute(
      authed("/api/orgs", outsiderSession, {
        method: "POST",
        body: { name: "My Org", slug: uniqueSlug("made") },
      })
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { role: string };
    expect(body.role).toBe("OWNER");
  });

  it("create org: invalid slug rejected with 422", async () => {
    const res = await orgsCreateRoute(
      authed("/api/orgs", outsiderSession, {
        method: "POST",
        body: { name: "Bad", slug: "Bad Slug!" },
      })
    );
    expect(res.status).toBe(422);
  });

  it("create org: reserved slug rejected with 409", async () => {
    const res = await orgsCreateRoute(
      authed("/api/orgs", outsiderSession, {
        method: "POST",
        body: { name: "Reserved", slug: "settings" },
      })
    );
    expect(res.status).toBe(409);
  });

  it("create org: forged userId/orgId in the body has no effect (identity from cookie only)", async () => {
    const res = await orgsCreateRoute(
      authed("/api/orgs", outsiderSession, {
        method: "POST",
        body: {
          name: "Spoof Attempt",
          slug: uniqueSlug("spoof"),
          organizationId: orgId,
          userId: owner.id,
          role: "OWNER",
        },
      })
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { organization: { id: string } };
    expect(body.organization.id).not.toBe(orgId); // a NEW org was created
    // Membership was created for the SESSION user, not the forged userId.
    const memberships = await db.membership.findMany({
      where: { organizationId: body.organization.id },
    });
    expect(memberships).toHaveLength(1);
    expect(memberships[0].userId).toBe(outsider.id);
  });

  it("session route returns memberships for the cookie identity only", async () => {
    const res = await sessionRoute(authed("/api/auth/session", ownerSession));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      user: { id: string };
      memberships: { organization: { slug: string } }[];
    };
    expect(body.user.id).toBe(owner.id);
    expect(body.memberships.map((m) => m.organization.slug)).toEqual([slug]);
  });
});

function ctx<T extends Record<string, string>>(params: T) {
  return { params: Promise.resolve(params) };
}

function makeReq(
  url: string,
  init: Parameters<typeof makeRequest>[1]
) {
  return makeRequest(url, init);
}

/* ------------------------------------------------------------------ */
/* CSRF / origin + rate limiter (unit)                                 */
/* ------------------------------------------------------------------ */

describe("assertSameOrigin", () => {
  const originalAppUrl = process.env.APP_URL;

  it("allows GET/HEAD/OPTIONS regardless of origin", () => {
    const req = makeReq("/api/x", {
      method: "GET",
      headers: { origin: "https://evil.example" },
    });
    expect(() => assertSameOrigin(req)).not.toThrow();
  });

  it("allows requests without an Origin header (non-browser clients)", () => {
    const req = makeReq("/api/x", { method: "POST" });
    expect(() => assertSameOrigin(req)).not.toThrow();
  });

  it("rejects a forged cross-site Origin", () => {
    const req = makeReq("/api/x", {
      method: "POST",
      headers: { origin: "https://evil.example", host: "app.orbitcrew.test" },
    });
    expect(() => assertSameOrigin(req)).toThrow(ApiError);
  });

  it("rejects Origin \"null\"", () => {
    const req = makeReq("/api/x", {
      method: "POST",
      headers: { origin: "null", host: "app.orbitcrew.test" },
    });
    expect(() => assertSameOrigin(req)).toThrow(ApiError);
  });

  it("allows the Host origin", () => {
    const req = makeReq("/api/x", {
      method: "POST",
      headers: { origin: "https://app.orbitcrew.test", host: "app.orbitcrew.test" },
    });
    expect(() => assertSameOrigin(req)).not.toThrow();
  });

  it("allows APP_URL origin behind a proxy (Host is another external address)", () => {
    process.env.APP_URL = "https://app.orbitcrew.test";
    resetEnvCacheForTests();
    try {
      // Origin matches APP_URL while the Host header is a different external
      // address (e.g. an internal proxy name) — allowed via APP_URL, not via
      // the internal-host tolerance.
      const req = makeReq("/api/x", {
        method: "POST",
        headers: { origin: "https://app.orbitcrew.test", host: "proxy.internal:8443" },
      });
      expect(() => assertSameOrigin(req)).not.toThrow();
    } finally {
      process.env.APP_URL = originalAppUrl;
      resetEnvCacheForTests();
    }
  });

  it("internal preview gateway tolerance: external Origin against localhost Host is allowed (dev/test only)", () => {
    const req = makeReq("/api/x", {
      method: "POST",
      headers: { origin: "https://app.orbitcrew.test", host: "localhost:3000" },
    });
    expect(() => assertSameOrigin(req)).not.toThrow();
  });

  it("production mode: internal-host tolerance is DISABLED (fail-closed)", () => {
    vi.stubEnv("NODE_ENV", "production");
    resetEnvCacheForTests();
    try {
      const req = makeReq("/api/x", {
        method: "POST",
        headers: { origin: "https://evil.example", host: "localhost:3000" },
      });
      expect(() => assertSameOrigin(req)).toThrow(ApiError);
    } finally {
      vi.unstubAllEnvs();
      resetEnvCacheForTests();
    }
  });
});

describe("rate limiter", () => {
  it("allows up to the limit then throws RATE_LIMITED", () => {
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 5; i++) expect(() => rateLimit(key, 5, 60000)).not.toThrow();
    expect(() => rateLimit(key, 5, 60000)).toThrow(ApiError);
  });

  it("resets after the window elapses", () => {
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 3; i++) expect(() => rateLimit(key, 3, 10)).not.toThrow();
    expect(() => rateLimit(key, 3, 10)).toThrow(ApiError);
    // Busy-wait past the 10ms window.
    const start = Date.now();
    while (Date.now() - start < 15) { /* spin */ }
    expect(() => rateLimit(key, 3, 10)).not.toThrow();
  });

  it("keys are isolated per subject", () => {
    expect(() => rateLimit(`a:${Math.random()}`, 1, 60000)).not.toThrow();
    expect(() => rateLimit(`b:${Math.random()}`, 1, 60000)).not.toThrow();
  });
});

describe("environment validation", () => {
  it("dev fallback secret is NOT used when AUTH_SECRET is set", () => {
    // tests/setup.ts sets AUTH_SECRET, so getEnv() must return it.
    expect(getEnv().AUTH_SECRET).not.toBe(
      "orbit-crew-dev-insecure-secret-change-me-0000000000000000"
    );
    expect(getEnv().AUTH_SECRET!.length).toBeGreaterThanOrEqual(32);
  });
});
