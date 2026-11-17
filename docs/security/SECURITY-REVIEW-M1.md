# Security Review — M1 Project Foundation

- **Date:** 2026-11-17
- **Scope:** Everything shipped in M1 (authentication, sessions, organizations,
  memberships, RBAC, multi-tenant authorization, environment validation)
- **Method:** source review of all `src/lib/**` and `src/app/api/**` code,
  an HTTP-level verification matrix against the running server, and a
  browser end-to-end pass over the golden-path user journey.
- **Result:** **PASS** — all M1 security requirements verified with the
  exceptions tracked under "Known gaps" below.

## 1. Verified controls

Every item below was exercised against the running application, not merely
read from the code.

### Authentication and sessions

| # | Control | Where | Verified behavior |
|---|---------|-------|-------------------|
| 1 | scrypt password hashing with per-user salt | `src/lib/auth/password.ts` | Accounts created; hashes stored in `scrypt$N$r$p$salt$hash` format |
| 2 | Session token opaque, HMAC-hashed at rest | `src/lib/auth/session.ts` | Cookie holds base64url token; DB stores `HMAC-SHA256(AUTH_SECRET, token)` only |
| 3 | httpOnly + SameSite=Lax + Secure-in-prod cookie | `sessionCookieOptions()` | Cookie flag set on register/login responses; JS cannot read it |
| 4 | Session revocation | `logoutSession()` | Logout returned 200; subsequent session request returned 401 |
| 5 | Expiry + sliding refresh | `requireAuth()` | 30-day TTL, extended past half-life; invalid/revoked sessions rejected 401 |
| 6 | Login enumeration defenses | `loginUser()` | Unknown email and wrong password return the identical generic 401 message; dummy-hash timing equalization runs for unknown emails |
| 7 | Register rate limit (5/h/IP), login (20/10min/IP + 10/10min/email) | route handlers | In-memory limiter wired; throws 429 envelope |

### Multi-tenant authorization (cross-tenant matrix)

| # | Attempt | Expected | Result |
|---|---------|----------|--------|
| 1 | Authenticated user B reads org of user A (no membership) | 404, no existence leak | **404** `"Organization not found."` |
| 2 | User B (MEMBER) reads org detail after membership | 200 | **200** with `membership.role = MEMBER` |
| 3 | User B membership removed, reads org again | 404 | **404** (verified via remove-member flow) |
| 4 | MEMBER renames organization | 403 | **403** FORBIDDEN |
| 5 | MEMBER deletes organization | 403 | **403** |
| 6 | MEMBER adds a member | 403 | **403** |
| 7 | MEMBER self-promotes (role change on own membership) | 403 | **403** `"You cannot change your own role here..."` |
| 8 | MEMBER changes a higher-ranked member | 403 | **403** (rank rule `canActOn`) |
| 9 | OWNER transfers ownership | 200, actor→ADMIN, target→OWNER | **200**; role list confirmed `[Alice ADMIN, Bob OWNER]`; transfer-back symmetric |
| 10 | Remove the OWNER | 403 | **403** (owner is unremovable; transfer first) |
| 11 | Add unknown email as member | 404 | **404** with guidance message |
| 12 | Duplicate membership | 409 | **409** CONFLICT |

### Input validation and CSRF

| # | Control | Verified behavior |
|---|---------|-------------------|
| 1 | Zod validation on every mutating body | Invalid slug → 422 with field-level message; malformed JSON → 400 |
| 2 | Reserved organization slugs | `admin` → 409 `"This slug is reserved and cannot be used."` |
| 3 | Slug uniqueness | Duplicate slug → 409 (DB-level `P2002` mapped) |
| 4 | Same-origin enforcement on mutations | Forged `Origin: https://evil.example` against a real Host → **403** `"Cross-origin request blocked."`; matching origin → request proceeds; SameSite=Lax cookie is the baseline defense |
| 5 | Error envelope consistency | All failures return `{ error: { code, message } }`; internal details never leaked (500 handler logs server-side only) |

### Environment and repository

| # | Control | Verified behavior |
|---|---------|-------------------|
| 1 | Env validation | `AUTH_SECRET` required (≥32 chars); production fails fast; dev fallback is clearly labelled and warned |
| 2 | No secrets in the repository | `.env` gitignored (`.env*` with `!.env.example`); only `.env.example` committed |
| 3 | No secrets in logs | Session tokens never logged; Prisma query logging disabled; error handler logs messages/stacks, not request bodies |
| 4 | Runtime DB not committed | `/db` gitignored |

## 2. Browser end-to-end pass (golden path)

Executed with a headless browser against the running app; zero console
errors and zero page errors across the whole pass:

1. Landing renders (hero, milestone chips marked Planned, security strip).
2. Register → signed in → onboarding (welcome toast).
3. Create organization (slug auto-suggested, reserved-slug hint) → overview.
4. Settings: members table, add member (existing account) → appears as MEMBER.
5. Role change MEMBER → ADMIN succeeds with toast; table updates.
6. Future-feature sections are visibly non-functional (disabled buttons,
   milestone chips) — nothing pretends capability that does not exist.
7. Theme toggle switches dark mode (`html.dark` verified).
8. Mobile viewport (390×844): hamburger sheet navigation, layout intact,
   footer pinned to the bottom; desktop footer is sticky on short pages.
9. Sign out → landing; sign in → back to overview with memberships intact.

## 3. Known gaps (tracked, not blockers for M1 acceptance)

1. **In-memory rate limiting** — per-process only; production multi-instance
   deployments need a shared store (PostgreSQL-backed or Redis). Tracked in
   `src/lib/api/rate-limit.ts` comments.
2. **Security headers / CSP** — not yet configured in `next.config`
   (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy,
   CSP). Planned before public release; requires a config-change + restart
   cycle that is deliberately deferred out of this milestone's verified scope.
3. **No email verification / password reset** — deferred with ADR-002.
4. **No audit log** — M7 scope per the roadmap.
5. **SQLite as the development database** — production is PostgreSQL
   (ADR-003, `infra/docker/docker-compose.yml`).
6. **Client IP trust** — `getClientIp` trusts `X-Forwarded-For` from the
   gateway; production must restrict this to the known proxy hop.

## 4. Sign-off

M1 security requirements are implemented and verified. The next batch
(M2) must re-run this review as a delta and extend it with credential-vault
threat modeling before any API-key storage lands.
