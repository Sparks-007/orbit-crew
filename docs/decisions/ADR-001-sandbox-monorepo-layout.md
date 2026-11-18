# ADR-001: Sandbox monorepo layout

- **Status:** Accepted
- **Date:** 2026-11-17
- **Scope:** Repository and workspace structure

## Context

The target architecture is a pnpm-workspaces + Turborepo monorepo: `apps/web` (this Next.js control plane), `services/runtime` (future execution runtime), and shared packages (`packages/database`, `packages/contracts`, `packages/config`, `packages/auth`).

The current cloud sandbox, however, runs a single pre-provisioned Next.js application whose development pipeline — `bun run dev` on :3000, gateway routing, log capture — assumes the app lives at the repository root. Restructuring the repository into workspaces now risks breaking that running pipeline, and M1 has no code that actually requires workspace-level package boundaries.

## Decision

1. Implement M1 inside the root Next.js app; it is the de-facto `apps/web` package.
2. Organize shared logic in `src/lib` subpackages that mirror the target packages: `contracts` (shared schemas/types), `auth`, `api` (request pipeline), `orgs` (domain services), plus `db.ts` and `env.ts` — the future `packages/database` and `packages/config` content.
3. Create the documentation and infrastructure directories now — `docs/`, `infra/`, `services/runtime/` (placeholder), `scripts/` — so the future split is a move, not a rewrite.
4. Defer the physical pnpm/Turbo split until after M1 acceptance. The documented migration is: create `pnpm-workspace.yaml` + `turbo.json`, move the root app into `apps/web`, extract `packages/*` from the `src/lib` subpackages, and update scripts.

## Consequences

- (+) Zero risk to the sandbox dev pipeline; faster iteration in M1.
- (+) Directory boundaries already match the target package layout, keeping the future move mechanical.
- (-) Shared-package boundaries are directory conventions, not enforced workspace packages: there is no independent versioning or build isolation until the split.
- (-) Import paths (`@/lib/...`) will need remapping to package names during the migration.

## Revisit trigger

Start of Batch 2, or as soon as a second service (non-web) needs to share code with the app — whichever comes first.

## 2026-11-18 audit review

Re-evaluated as part of the M1 audit, with Batch 2 (M2 Model Gateway + BYOK,
M3 AI employee creation) in scope. **Recommendation: Option A — keep the
current structure for Batch 2.** Rationale:

- M2's work (model gateway, encrypted credentials, usage tracking) is
  entirely contained in the Next.js control plane; no second service shares
  code yet, so the split buys no build isolation today.
- `services/runtime/` remains a documented placeholder until M3/M4; the
  trigger in this ADR has not fired.
- A pre-M2 restructuring would land a large mechanical migration (import
  remapping, workspace tooling, CI changes) immediately before the most
  security-sensitive milestone (credential storage), maximizing review
  surface for zero functional gain.
- The migration path documented above stays valid and is exercised as a
  "move, not a rewrite" when the trigger fires.

Re-review at the start of Batch 3 (M4), when the runtime service begins to
consume shared contracts.
