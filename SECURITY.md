# Security Policy

## Supported versions

Orbit Crew is a pre-release project; the M1 foundation (v0.1.x) is the only supported line.

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |
| < 0.1.0 | No |

## Reporting a vulnerability

**Primary channel: GitHub Private Vulnerability Reporting.**

Use the repository's **Security → Report a vulnerability** flow on GitHub. This keeps reports private end-to-end, allows private discussion and fixes, and requires no email address.

- Send a private report; **do not open a public GitHub issue**.
- Include a description, affected routes/files, and minimal reproduction steps or a proof of concept.
- **Do not include real secrets, credentials, or other users' data** in reports or PoCs. Redact tokens, cookies and passwords; use throwaway accounts you own.
- Do not disclose the issue publicly until a fix has shipped and an advisory is published.
- Expected response times: initial triage within 72 hours; a status update at least weekly until resolution.
- Please give maintainers reasonable time to patch before any public disclosure.

> Maintainers: before the public release, confirm the repository has Private Vulnerability Reporting enabled (Settings → Code security and analysis) and decide whether to add a monitored security email address here. No email address is published in this file by default.

## Scope

In scope: this repository's application code — authentication and sessions, authorization/RBAC, multi-tenant isolation, API routes, infrastructure definitions (`infra/`), CI configuration.

Out of scope (report via the channel above only if you believe a genuine risk exists): the SQLite local development mode being non-production-grade (documented limitation), and missing features listed in the roadmap or in "Known limitations" below.

## Security features implemented in M1

Verified against the code in this repository (and covered by the automated test suite):

- **Password hashing**: scrypt (memory-hard KDF, N=16384, r=8, p=1) with a per-user random 16-byte salt, NFKC normalization, and a versioned encoded format (`scrypt$N$r$p$salt$hash`) so parameters can be upgraded without invalidating existing hashes. Verification uses `timingSafeEqual`.
- **Session tokens at rest**: opaque 32-byte base64url tokens; only `HMAC-SHA256(AUTH_SECRET, token)` is stored. A stolen database dump cannot be replayed as sessions without the application secret.
- **Session cookies**: `httpOnly` (no JavaScript access, nothing in browser storage), `SameSite=Lax`, `Secure` in production, path-scoped, 30-day expiry.
- **Server-side revocation**: logout and invalidation update `revokedAt`; expired or revoked sessions are rejected on every request.
- **Per-request server-side identity**: identity comes exclusively from the session cookie; client-supplied user IDs are never trusted.
- **Membership-scoped authorization**: organization access resolves through the Membership table with a rank hierarchy (OWNER > ADMIN > MEMBER); privileged operations check `hasPermission`, modifications target only strictly lower-ranked members, and granting ADMIN is OWNER-only. Ownership transfer runs in a transaction with a conditional demotion step, preserving the single-owner invariant under concurrent transfers.
- **No existence leaks**: requests for organizations the caller is not a member of return 404, not 403, so foreign tenants cannot probe which organizations exist.
- **CSRF defense-in-depth**: same-origin enforcement on all mutating requests (Origin vs Host/APP_URL; `Origin: null` rejected), layered on SameSite=Lax cookies. The internal-host tolerance used by the sandbox preview gateway is disabled in production (fail closed).
- **Rate limiting**: register (5/hour per IP), login (20/10 min per IP, 10/10 min per email), org creation (10/hour per user), member addition (30/hour per user).
- **Input validation**: every request body is parsed against a Zod schema; failures return a typed 422 envelope.
- **Login timing equalization**: unknown emails run a dummy scrypt verification so responses are indistinguishable from wrong-password responses.
- **Reserved organization slugs**: platform and well-known route names cannot be claimed as org slugs.
- **Secrets hygiene**: `.env` is gitignored; only `.env.example` (placeholders only) is committed. `AUTH_SECRET` is validated (min 32 chars), enforced fail-fast in production, and a production boot rejects the `.env.example` placeholder value verbatim.
- **CI verification**: quality (lint/typecheck/prisma validate), integration tests on SQLite and against PostgreSQL 16, and a production build from a clean checkout run on every push and pull request.

## Known limitations and planned work

Stated honestly, current gaps:

- The rate limiter is an in-memory fixed-window Map — it is single-instance only and resets on restart. A shared store (Redis or PostgreSQL) is required for multi-instance deployments.
- No email verification or password reset flows yet (planned for M2).
- No audit logs yet (planned for M7).
- No Content-Security-Policy or additional hardening headers yet.
- SQLite is a development database; production targets PostgreSQL (see `docs/architecture/database.md` for the provider switch).
- The project is **not production-ready**: capabilities beyond the M1 foundation do not exist yet, and no deployment has completed the PostgreSQL/migrations adoption path.

A milestone-by-milestone review lives in `docs/security/SECURITY-REVIEW-M1.md`.
