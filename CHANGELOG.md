# Changelog

All notable changes to Orbit Crew are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-11-17

### M1 — Project Foundation

### Added

- Password authentication: scrypt (N=16384, r=8, p=1) with per-user salt and a versioned hash format; opaque session tokens (32 random bytes, base64url) stored as HMAC-SHA256(AUTH_SECRET, token); httpOnly, SameSite=Lax, Secure-in-production cookies; server-side revocation; 30-day TTL with sliding refresh past half-life.
- Organizations with slug validation and a reserved-word guard; the creator becomes OWNER inside a single transaction.
- Memberships with the OWNER/ADMIN/MEMBER RBAC matrix, rank hierarchy (actors may only modify strictly lower-ranked members), single-owner invariant, and transactional ownership transfer.
- Multi-tenant authorization guards: identity resolved server-side from the session cookie only, membership-scoped org context, and 404 (not 403) responses for foreign-tenant resources to prevent existence leaks.
- REST API surface: `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/session`, `/api/orgs`, `/api/orgs/[slug]`, `/api/orgs/[slug]/members`, `/api/orgs/[slug]/members/[membershipId]`, `/api/health` — Zod-validated bodies and a consistent typed error envelope.
- Rate limiting (in-memory fixed window): register 5/hour per IP; login 20/10 min per IP and 10/10 min per email; organization creation 10/hour per user; member addition 30/hour per user.
- Environment validation: `AUTH_SECRET` (min 32 chars) fail-fast in production; clearly-labelled insecure fallback with warning in development.
- Prisma schema (User, Session, Organization, Membership) and the `db:push` workflow on SQLite.
- Health endpoint with a database connectivity probe (200 ok / 503 degraded).
- UI application: landing page, register/login, organization onboarding, org switcher, overview dashboard, member management with role-based affordances, settings with danger zone, dark mode — a single-route client-side shell over the typed API client, with Sonner toasts and next-themes dark mode.
- Infrastructure artifacts: multi-stage Bun Dockerfile (standalone output, non-root, healthcheck), docker-compose stack with PostgreSQL 16, deployment notes, runtime-service placeholder, and CI (lint + typecheck).
- Documentation set: architecture overview, database guide, ADR-001 (sandbox monorepo layout), ADR-003 (SQLite in sandbox), security review, contributing and security policies.

### Security

- Same-origin enforcement on every mutating request (Origin vs Host/APP_URL), layered on SameSite=Lax cookies.
- Generic authentication errors and timing-equalized login (dummy scrypt verification for unknown emails) to prevent account enumeration.
- Reserved organization slugs protecting platform and well-known routes.
- Tenant-scoped queries on every server-side lookup; client-submitted organization IDs are never trusted.
- No secrets committed: `.env` is gitignored; only `.env.example` is tracked.
