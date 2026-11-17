# Architecture Overview

Status: M1 — Project Foundation (v0.1.0, 2026-11-17).

## Three-layer architecture

Orbit Crew is planned as three layers. M1 implements the first one.

### 1. Control Plane (implemented in M1)

This Next.js application. It owns accounts, organizations, memberships and role-based access: authentication and sessions, the multi-tenant authorization model, the REST API surface, and the UI shell. Everything described in the sections below is implemented and running today.

### 2. Orbit Runtime (planned — not built in M1)

The execution layer for AI employees: model gateway communication (M2), task lifecycle and streaming (M4), memory and file access (M5), and tool execution (M6). Architectural reference: **Nod** — patterns studied for isolated execution, task lifecycle and streaming design; never copied or deployed unchanged. The runtime will live in `services/runtime` (currently a documented placeholder; see that directory's README).

### 3. Execution Layer (planned)

Isolated browser environments, workspace containers and network restrictions that give AI employees safe compute (M6). This layer enforces isolation from the control plane and between customers.

## Data model (M1)

From `prisma/schema.prisma`:

| Model | Purpose | Key constraints |
| --- | --- | --- |
| `User` | Account: email, name, password hash | `email` unique |
| `Session` | Server-side session | `tokenHash` unique (HMAC of token), `expiresAt`, `revokedAt`, audit fields (`ipAddress`, `userAgent`, `createdAt`, `lastUsedAt`), index on `userId`, cascade delete with user |
| `Organization` | Tenant | `slug` unique |
| `Membership` | User-in-organization grant | Unique per (`userId`, `organizationId`); `role` stored as a string validated at the app level (`"OWNER" \| "ADMIN" \| "MEMBER"`); cascade deletes; index on `organizationId` |

## Tenant isolation rules

Enforced server-side on every request:

1. Org-owned records carry an explicit organization association.
2. Every server-side query is constrained to the authorized organization scope.
3. Client-submitted organization IDs are never trusted; the org is resolved server-side via the URL slug plus the caller's membership.
4. Membership is verified before any read or write.
5. The role is verified (RBAC matrix) before any privileged operation.
6. Cross-tenant access fails securely: 404, not 403, so existence is never leaked.
7. Automated cross-tenant tests are planned to lock these guarantees in.
8. Frontend visibility never grants permissions — the UI only reflects what the API already enforces.

## RBAC matrix

From `src/lib/contracts/rbac.ts` (hierarchy: OWNER > ADMIN > MEMBER; `canActOn` allows modifying only strictly lower-ranked members; single-owner invariant; ownership transfer runs in a transaction — the actor drops to ADMIN, the target becomes OWNER):

| Role | org:read | org:update | org:delete | member:read | member:add | member:add:admin | member:update:member | member:update:admin | member:remove:member | member:remove:admin | ownership:transfer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OWNER | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| ADMIN | yes | yes | — | yes | yes | — | yes | — | yes | — | — |
| MEMBER | yes | — | — | yes | — | — | — | — | — | — | — |

## API surface

All routes live in `src/app/api`. Mutating routes also enforce same-origin. Rate limits are per in-memory fixed window (single instance).

| Route | Method | Auth | Permission guard | Rate limit |
| --- | --- | --- | --- | --- |
| `/api/auth/register` | POST | Public | — | 5/hour per IP |
| `/api/auth/login` | POST | Public | — | 20/10 min per IP; 10/10 min per email |
| `/api/auth/logout` | POST | Presented cookie (idempotent) | — | — |
| `/api/auth/session` | GET | Authenticated | — | — |
| `/api/orgs` | GET | Authenticated | Own memberships only | — |
| `/api/orgs` | POST | Authenticated | Creator becomes OWNER | 10/hour per user |
| `/api/orgs/[slug]` | GET | Membership | `org:read` | — |
| `/api/orgs/[slug]` | PATCH | Membership | `org:update` (ADMIN+) | — |
| `/api/orgs/[slug]` | DELETE | Membership | `org:delete` (OWNER) | — |
| `/api/orgs/[slug]/members` | GET | Membership | `member:read` | — |
| `/api/orgs/[slug]/members` | POST | Membership | `member:add` (ADMIN+) or `member:add:admin` (OWNER) for ADMIN grants | 30/hour per user |
| `/api/orgs/[slug]/members/[membershipId]` | PATCH | Membership | Role-targeted checks in the service: rank rule, self-change guard, `ownership:transfer` for OWNER grants | — |
| `/api/orgs/[slug]/members/[membershipId]` | DELETE | Membership | Role-targeted checks in the service: `member:remove:member` / `member:remove:admin`, owner-removal guard | — |
| `/api/health` | GET | Public | — | — |

## Request pipeline

Route handlers compose the same building blocks (`src/lib/api/*`, `src/lib/auth/guards.ts`):

1. `assertSameOrigin` — reject cross-origin mutations (Origin vs Host/APP_URL).
2. `rateLimit` — fixed-window limit keyed by IP, email or user.
3. `requireAuth` / `requireOrgContext(slug, permission)` — resolve the session from the cookie, then the membership and role; foreign-tenant requests get 404.
4. `parseJsonBody(Zod)` — validate the body against a contract schema.
5. Service call (`src/lib/orgs/service.ts`, `src/lib/auth/service.ts`) with transactional guards where invariants demand it (org creation, ownership transfer).
6. `handleRoute` converts `ApiError`, Zod issues, or unexpected faults into the consistent error envelope `{ error: { code, message } }`.

Error codes and statuses: BAD_REQUEST 400, VALIDATION_ERROR 422, UNAUTHORIZED 401, FORBIDDEN 403, NOT_FOUND 404, CONFLICT 409, RATE_LIMITED 429, INTERNAL_ERROR 500. Internal error details are logged, never returned to the client.
