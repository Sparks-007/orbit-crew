# Orbit Crew — Roadmap

Current status: Phase 1 / V1, Batch 1, Milestone **M1 shipped and independently audited** (v0.1.0, 2026-11-17; audit 2026-11-18). Batch 2 has **not started**.

**Status legend**

| Marker | Meaning |
| --- | --- |
| ✅ Shipped | Implemented, tested and verified in this repository (see [CHANGELOG.md](CHANGELOG.md)) |
| 📋 Planned | Approved for a milestone, **not started** — no implementation exists |
| 🔮 Future | Direction only — scope, order and existence may change |

**How to read this document:** only items marked ✅ exist in the code. Everything else is a plan; do not assume a feature is implemented because it appears here.

## Phase 1 — V1 Core AI Workforce (M1–M7) · 📋 Planned

V1 release condition: "A customer can register, connect a model, create an AI employee, assign a task, receive completed work and securely manage task history."

### M1 — Project Foundation ✅ Shipped

Verified in the repository; every claim below is backed by the test suite and the independent audit:

- Monorepo init and Next.js application
- PostgreSQL + Prisma data layer (SQLite in the sandbox; PostgreSQL 16 compatibility verified by execution, provider switch automated)
- Authentication and sessions (scrypt, HMAC-hashed opaque tokens, revocation, sliding expiry)
- Organizations and memberships
- Multi-tenant authorization (404 no-leak semantics, cross-tenant tests)
- Role-based permissions (OWNER/ADMIN/MEMBER matrix, single-owner invariant, race-safe ownership transfer)
- Docker environment (multi-stage non-root image, PostgreSQL 16 compose stack)
- Environment validation (fail-fast production boot)
- Documentation (architecture, database guide, ADR-001/002/003, security review)
- Persistent automated suite: 99 tests on SQLite and PostgreSQL; CI with quality/tests-sqlite/tests-postgres/build jobs

### M2 — Model Gateway and BYOK 📋 Planned

- GLM integration through a model gateway
- Encrypted storage of customer-provided API keys (BYOK)
- Model routing across providers
- Usage tracking per organization

### M3 — AI Employee Creation 📋 Planned

- Employee definitions: name, role, instructions
- Model and credential selection per employee
- Employee templates
- Employee list and detail management

### M4 — Individual Task Execution 📋 Planned

- Task lifecycle: queued, running, completed, failed
- Streaming output
- Cancellation, timeouts, retries
- Structured results and task history

### M5 — AI Memory and Files 📋 Planned

- Per-employee memory store
- File upload and workspace storage
- Memory and file retrieval during tasks
- Retention controls

### M6 — Tools and Browser Execution 📋 Planned

- Isolated browser execution environment
- Workspace filesystem access
- Network restrictions and egress control

### M7 — Approvals, Monitoring and Launch 📋 Planned

- Approval inbox for sensitive actions
- Audit logs
- Cost tracking
- Platform rate limits
- Security testing and production readiness

## Batch plan

| Batch | Milestones | Status |
| --- | --- | --- |
| Batch 1 | M1 | ✅ Shipped + audited |
| Batch 2 | M2 + M3 | 📋 Not started |
| Batch 3 | M4 + M5 | 📋 Not started |
| Batch 4 | M6 + M7 | 📋 Not started |

Each batch is tested and reviewed before the next begins.

## Phase 2 — V2 Collaborative AI Workforce (M8–M13) · 📋 Planned — not started

Scope expands the shipped V1 foundation toward coordinated collaboration. Nothing in this phase is implemented; sequencing and scope may be revised as V1 lands.

### M8 — AI Coordinator

- Coordinator agent that plans and distributes work
- Goal decomposition into employee assignments
- Progress aggregation and reporting

### M9 — Teams

- Team creation from individual AI employees
- Team rosters and roles
- Team-level task assignment

### M10 — Multi-Agent Delegation

- Coordinator-to-employee delegation protocol
- Shared task context across agents
- Handoffs and escalation rules

### M11 — Shared Memory and Collaboration

- Shared memory scoped to a team
- Inter-agent collaboration history
- Visibility and conflict rules for shared context

### M12 — Workflow Monitoring

- Live workflow and run monitoring
- Per-step status and timelines

### M13 — Integrations and Scheduling

- External integrations for employees and teams
- Scheduled and recurring tasks
- Trigger-based workflows

## Phase 3 — V3 AI Workforce OS (M14–M18) · 🔮 Future — exploratory

Long-term direction beyond the collaborative workforce. Items here are aspirational, unordered and may change substantially or be replaced.

### M14 — AI Employee Marketplace

- Publishing employee templates
- Discovery, install and reviews

### M15 — Integration Ecosystem

- Public integration API and SDKs
- Third-party app directory
- Webhooks and event subscriptions

### M16 — Advanced Automation

- Visual workflow builder
- Conditional logic and branching
- Cross-team automation policies

### M17 — Billing and Analytics

- Subscription billing and usage-based pricing
- Cost analytics per org, team and employee
- Invoicing and spend controls

### M18 — Enterprise Capabilities

- SSO / SAML and directory sync
- Expanded enterprise RBAC and policies
- Compliance, data residency and SLAs
