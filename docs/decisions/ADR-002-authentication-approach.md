# ADR-002 — Authentication approach for M1

- **Status:** Accepted
- **Date:** 2026-11-17
- **Scope:** M1 (Project Foundation) — email/password authentication and sessions

## Context

The master specification names **Better Auth** as the preferred authentication
library, explicitly "subject to compatibility verification". M1 requires:
secure session handling, password security, server-side identity
verification, session expiration and revocation.

The current environment imposes constraints that shape the verification:

1. The development sandbox provides **Prisma against SQLite** (db file under
   `db/`, schema applied with `prisma db push`). The production target is
   PostgreSQL (ADR-003).
2. The application is served behind a **preview gateway** that proxies an
   external origin to the local server, which affects cookie/origin handling
   that auth libraries pin against a fixed `baseURL`.
3. Next.js 16 + React 19 are very recent; the library's declared peer support
   for this exact combination could not be verified inside the sandbox
   without committing to it.

## Decision

For M1, implement a **self-contained, auditable session authentication
package** in `src/lib/auth/` instead of adopting Better Auth now.

What is implemented:

- **Password hashing:** scrypt (N=16384, r=8, p=1, 64-byte key) with a
  per-user random salt, encoded as `scrypt$N$r$p$salt$hash` so parameters can
  be upgraded without invalidating hashes
  (`src/lib/auth/password.ts`).
- **Session tokens:** 32 random bytes (base64url) held only in an
  httpOnly, SameSite=Lax, Secure-in-production cookie (`oc_session`); stored
  server-side as `HMAC-SHA256(AUTH_SECRET, token)` so a leaked database dump
  cannot be replayed without the application secret
  (`src/lib/auth/session.ts`).
- **Session lifecycle:** 30-day absolute TTL with sliding refresh past the
  half-life, server-side revocation on logout
  (`src/lib/auth/guards.ts`, `src/app/api/auth/logout`).
- **Enumeration defenses:** generic login errors and timing equalization
  against a dummy hash for unknown emails
  (`src/lib/auth/service.ts`).
- **Authorization:** per-request server-side identity via
  `requireAuth()`, organization access via membership lookup with
  `requireOrgContext()`, RBAC matrix in `src/lib/contracts/rbac.ts`.

## Alternatives considered

- **Better Auth (deferred):** strong library and still the preferred candidate
  for the production monorepo. Rejected *for this environment* because its
  managed session/origin configuration assumes a fixed baseURL, it wants to
  own the user/session/account/verification tables (colliding with the
  sandbox SQLite + `db:push` workflow), and Next.js 16 compatibility could not
  be verified here.
- **NextAuth.js v4 (available in the sandbox):** pages-router-era APIs with a
  weaker App Router story; the specification itself preferred Better Auth over
  it.
- **Stateless JWT sessions:** rejected — revocation and rotation are harder to
  guarantee; the specification requires server-side revocation.

## Consequences

**Positive**

- Deterministic delivery of every M1 security requirement with zero new
  dependencies; the entire security surface is ~600 lines of reviewable code.
- Cookie/origin behavior is explicitly adapted to the gateway environment
  (`src/lib/api/request.ts`) and was verified end-to-end in the sandbox.

**Negative / accepted trade-offs**

- Features Better Auth provides out of the box (OAuth providers, email
  verification, password reset, 2FA) are not implemented in M1 and are
  tracked as follow-ups (M2+).
- The user/session tables must map cleanly to Better Auth's schema if it is
  adopted later. The current fields (id, email, name, passwordHash; token
  hash, expiresAt, revokedAt, ip, userAgent) are a compatible superset of the
  core `user`/`session` concepts, making a future migration additive.

## Revisit trigger

- Start of **M2** (the first OAuth/BYOK integration work), or
- Any production deployment preceding the monorepo split.

At that point, re-verify Better Auth (or equivalent) against Next.js 16 +
Prisma + PostgreSQL, and migrate `User`/`Session` to the library-owned
tables.
