# Orbit Runtime (placeholder)

Status: documented placeholder only. **This directory is intentionally empty of code in M1.**

The Orbit Runtime is the execution layer of Orbit Crew and is scheduled after the control plane foundation. It is NOT built in Milestone M1.

## Planned responsibilities

- **AI employee execution** — running employee instructions against assigned tasks.
- **Model gateway calls** — communication with model providers through the gateway built in M2, using customer-provided credentials (BYOK).
- **Tool execution** — invoking tools and the isolated browser environment (M6) on behalf of employees.
- **Task lifecycle** — queueing, streaming output, cancellation, timeouts, retries and structured results (M4), plus per-run state.
- **Multi-agent delegation (V2)** — the coordinator-to-employee delegation protocol and shared team context.

## Security posture

The runtime must be isolated on two axes:

1. **From the control plane** — the runtime never trusts control-plane state implicitly; it receives explicit, scoped execution context (employee, task, credentials handle, limits).
2. **From other customers** — execution environments (browser, filesystem, network) are isolated per organization; no cross-tenant data or network access.

## References

- Architecture and layer responsibilities: [docs/architecture/overview.md](../../docs/architecture/overview.md)
- Why this directory exists as a placeholder inside the root app workspace: [docs/decisions/ADR-001-sandbox-monorepo-layout.md](../../docs/decisions/ADR-001-sandbox-monorepo-layout.md)
