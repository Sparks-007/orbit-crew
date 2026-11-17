# Orbit Crew — Roadmap

Current status: Phase 1 / V1, Batch 1, Milestone M1 shipped (v0.1.0, 2026-11-17).

## Phase 1 — V1 Core AI Workforce

V1 release condition: "A customer can register, connect a model, create an AI employee, assign a task, receive completed work and securely manage task history."

### M1 — Project Foundation (shipped)

- Monorepo init and Next.js application
- PostgreSQL + Prisma data layer (SQLite in the sandbox)
- Authentication and sessions
- Organizations and memberships
- Multi-tenant authorization
- Role-based permissions
- Docker environment
- Environment validation
- Documentation

### M2 — Model Gateway and BYOK

- GLM integration through a model gateway
- Encrypted storage of customer-provided API keys (BYOK)
- Model routing across providers
- Usage tracking per organization

### M3 — AI Employee Creation

- Employee definitions: name, role, instructions
- Model and credential selection per employee
- Employee templates
- Employee list and detail management

### M4 — Individual Task Execution

- Task lifecycle: queued, running, completed, failed
- Streaming output
- Cancellation, timeouts, retries
- Structured results and task history

### M5 — AI Memory and Files

- Per-employee memory store
- File upload and workspace storage
- Memory and file retrieval during tasks
- Retention controls

### M6 — Tools and Browser Execution

- Isolated browser execution environment
- Workspace filesystem access
- Network restrictions and egress control

### M7 — Approvals, Monitoring and Launch

- Approval inbox for sensitive actions
- Audit logs
- Cost tracking
- Platform rate limits
- Security testing and production readiness

## Batch plan

| Batch | Milestones |
| --- | --- |
| Batch 1 | M1 |
| Batch 2 | M2 + M3 |
| Batch 3 | M4 + M5 |
| Batch 4 | M6 + M7 |

Each batch is tested and reviewed before the next begins.

## Phase 2 — V2 Collaborative AI Workforce

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

## Phase 3 — V3 AI Workforce OS

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
