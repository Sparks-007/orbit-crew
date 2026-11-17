# Deployment

Status: M1 — Project Foundation (v0.1.0, 2026-11-17). Reference architecture: [docs/architecture/overview.md](../../docs/architecture/overview.md).

## What is provided

| Artifact | Purpose |
| --- | --- |
| `../docker/Dockerfile` | Multi-stage Bun image: deps → build (prisma generate + next build, standalone output) → non-root runner with a `/api/health` healthcheck. |
| `../docker/docker-compose.yml` | Production-parity stack: PostgreSQL 16 (`postgres:16-alpine`, named volume, `pg_isready` healthcheck) plus the web service wired to it. |

## What is NOT yet provided

- Managed platform deploy configs (Vercel, Fly, Render, etc.).
- Kubernetes manifests.
- Secrets management integration (Vault, cloud secret managers).
- TLS termination (terminate at the edge/proxy in front of the web service).
- An automated migration runner.

## Deploy checklist

1. **Database provider** — the schema targets SQLite in the sandbox. Complete the PostgreSQL switch per [docs/architecture/database.md](../../docs/architecture/database.md) before using the compose stack.
2. **AUTH_SECRET** — inject from a secret manager (never a committed file). Minimum 32 characters: `openssl rand -base64 32`. The app fails fast in production without it.
3. **APP_URL** — set the canonical public URL; it participates in the same-origin CSRF check behind proxies.
4. **Migrations** — run `prisma migrate deploy` against the production database before first start (and on each release). The image ships the Prisma schema for this purpose.
5. **Health check** — verify `GET /api/health` returns `200 {"status":"ok"}` after deploy; wire load balancer health checks to it.
6. **TLS** — enable HTTPS at the edge; session cookies are already flagged `Secure` in production.
7. **Secret scanning** — enable secret scanning on the repository to keep credentials out of version control.
8. **Database credentials** — change the compose defaults (`orbit`/`orbit`) for any real deployment.
