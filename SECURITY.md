# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |
| < 0.1.0 | No |

## Reporting a vulnerability

Report security issues privately to the maintainers at **security@orbitcrew.example** (placeholder address — replace with the real monitored inbox before public release).

- Send a private report; do not open a public GitHub issue.
- Include a description, reproduction steps, and affected routes/files where possible.
- Do not disclose the issue publicly until a fix has been shipped and an advisory is published.
- Expected response times: initial triage within 72 hours; a status update at least weekly until resolution.

## Security features implemented in M1

Verified against the code in this repository:

- **Password hashing**: scrypt (memory-hard KDF, N=16384, r=8, p=1) with a per-user random 16-byte salt, NFKC normalization, and a versioned encoded format (`scrypt$N$r$p$salt$hash`) so parameters can be upgraded without invalidating existing hashes. Verification uses `timingSafeEqual`.
- **Session tokens at rest**: opaque 32-byte base64url tokens; only `HMAC-SHA256(AUTH_SECRET, token)` is stored. A stolen database dump cannot be replayed as sessions without the application secret.
- **Session cookies**: `httpOnly` (no JavaScript access, nothing in browser storage), `SameSite=Lax`, `Secure` in production, path-scoped, 30-day expiry.
- **Server-side revocation**: logout and invalidation update `revokedAt`; expired or revoked sessions are rejected on every request.
- **Per-request server-side identity**: identity comes exclusively from the session cookie; client-supplied user IDs are never trusted.
- **Membership-scoped authorization**: organization access resolves through the Membership table with a rank hierarchy (OWNER > ADMIN > MEMBER); privileged operations check `hasPermission`, and modifications target only strictly lower-ranked members. Ownership transfer runs in a transaction and preserves the single-owner invariant.
- **No existence leaks**: requests for organizations the caller is not a member of return 404, not 403, so foreign tenants cannot probe which organizations exist.
- **CSRF defense-in-depth**: same-origin enforcement on all mutating requests (Origin vs Host/APP_URL) layered on SameSite=Lax cookies.
- **Rate limiting**: register (5/hour per IP), login (20/10 min per IP, 10/10 min per email), org creation (10/hour per user), member addition (30/hour per user).
- **Input validation**: every request body is parsed against a Zod schema; failures return a typed 422 envelope.
- **Login timing equalization**: unknown emails run a dummy scrypt verification so responses are indistinguishable from wrong-password responses.
- **Reserved organization slugs**: platform and well-known route names cannot be claimed as org slugs.
- **Secrets hygiene**: `.env` is gitignored; only `.env.example` is committed. `AUTH_SECRET` is validated (min 32 chars) and enforced fail-fast in production.

## Known limitations and planned work

Stated honestly, current gaps:

- The rate limiter is an in-memory fixed-window Map — it is single-instance only and resets on restart. A shared store (Redis or PostgreSQL) is required for multi-instance deployments.
- No email verification or password reset flows yet (planned for M2).
- No audit logs yet (planned for M7).
- No Content-Security-Policy or additional hardening headers yet.
- SQLite is a development database; production targets PostgreSQL (see `docs/architecture/database.md` for the provider switch).

A milestone-by-milestone review lives in `docs/security/SECURITY-REVIEW-M1.md`.
