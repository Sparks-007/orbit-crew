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

## 4. Independent audit (2026-11-18)

A second, source-level audit re-verified the controls above against the M1
baseline (`df7b0ed`) and added persistent automation. Results:

### Fixed findings

| # | Finding | Severity | Fix | Verification |
|---|---------|----------|-----|--------------|
| F1 | Concurrent ownership transfers could produce two OWNERs under PostgreSQL READ COMMITTED (both transactions read the actor as OWNER before demoting) | High | Conditional demotion (`updateMany where role="OWNER"`) as the serialization point; loser gets CONFLICT | `tests/orgs.test.ts` concurrency test passes on PostgreSQL 16.15 and SQLite |
| F2 | ADMIN could promote a MEMBER to ADMIN via `PATCH /members/[id]` — permission was keyed on the target's current role, contradicting the documented matrix ("granting ADMIN requires OWNER") | High | New guard: granting ADMIN requires `member:add:admin` (OWNER-only) | `tests/orgs.test.ts` "ADMIN cannot grant the ADMIN role" |
| F3 | Production accepted an AUTH_SECRET copied verbatim from `.env.example` (placeholder passes `min(32)`) | Medium | Placeholder values rejected at startup in production | `src/lib/env.ts`; startup abort verified (exit 1) |
| F4 | `Origin: null` was treated as "no origin" and allowed on mutations | Medium | Rejected (sandboxed-iframe contexts a legitimate client never produces) | unit + route tests |
| F5 | Internal-host CSRF tolerance (preview gateway) applied in every environment | Medium | Disabled in production — mismatched external origins fail closed | production-mode test |
| F6 | `next.config.ts` set `typescript.ignoreBuildErrors: true` — the production build would not fail on type errors | Medium | Removed; `next build` type-checks again | build passes without it |
| F7 | Server booted with missing AUTH_SECRET in production (500s only at first secret use) | Low-Med | `src/instrumentation.ts` fails fast at boot (exit code 1) | boot without secret → exit 1 |
| F8 | sharp (known CVEs in libvips/libheif/librsvg) shipped in the standalone bundle as Next's image-optimizer backend, reachable via `/_next/image` | Medium | `images.unoptimized: true` — M1 has zero `next/image` usage | no functional impact; bundle path removed from request flow |

### New persistent automation (replaces "manual checks only")

- `tests/` — 99 vitest tests, run against SQLite and PostgreSQL 16.15
  (`bun run test:sqlite` / `PG_TEST_URL=… bun run test:pg`). Covers
  registration/login/logout, revocation, expiry, sliding refresh, RBAC
  matrix, rank hierarchy, ownership transfer (incl. concurrency),
  cross-tenant matrix, forged IDs/payloads, origin/CSRF checks, rate limits.
- CI: `tests-sqlite`, `tests-postgres` (postgres:16-alpine service), plus
  `prisma validate` and a production build job.
- PostgreSQL compatibility is now evidence-backed: schema validation, fresh
  database initialization, unique indexes / FK cascades verified on the
  server via catalog queries, and 99/99 functional tests passing.

### Remaining known gaps (unchanged, tracked)

1. In-memory rate limiting (per-process; multi-instance needs a shared store).
2. `getClientIp` trusts `X-Forwarded-For` — spoofable per-IP limits until the
   proxy hop is pinned in production.
3. No email verification / password reset (ADR-002 follow-ups).
4. No audit log (M7).
5. No committed migrations yet — `prisma db push` workflow until the
   PostgreSQL migration adoption (documented in database.md; fresh-init
   verified).
6. Security headers / CSP still to configure before public release.
7. Session/DB hygiene: expired and revoked session rows are never purged
   (add a cleanup job in a later milestone).

### Custom authentication decision (ADR-002) — audit verdict

**Retained.** The implementation is compact (~600 lines), parameterized, and
now covered by the automated suite. No technical or security reason was found
to force a library migration for M1: scrypt parameters match current OWASP
guidance, tokens use a CSPRNG with HMAC-at-rest, revocation works, and the
enumeration defenses are sound. The documented revisit trigger (start of M2 /
first production deployment) stands; when Better Auth is re-evaluated, the
schema mapping notes in ADR-002 apply.

## 5. Sign-off

M1 security requirements are implemented and verified. The next batch
(M2) must re-run this review as a delta and extend it with credential-vault
threat modeling before any API-key storage lands.
