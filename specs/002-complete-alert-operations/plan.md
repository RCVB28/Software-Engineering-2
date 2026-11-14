# Implementation Plan: Alert Operations Completion

**Branch**: `002-complete-alert-operations` | **Date**: 2026-11-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-complete-alert-operations/spec.md`

## Summary

Complete the alert lifecycle by closing the gaps after a draft is saved and after a broadcast
finishes. The React + TypeScript frontend gains a draft-editing view, an administrator notification
center, a paged/filterable alert history, and resident personal alert history. The Node.js + Express
+ TypeScript backend extends the existing alerts, residents, and audit modules with persisted
failure notifications, offset-paginated history queries, concurrency-safe draft writes, and an
in-process daily retention scheduler backed by a persisted run log.

No new runtime dependency, framework, or datastore is introduced. PostgreSQL/Prisma remains the
source of truth; alerts continue to be delivered through the existing `MessagingProvider`
abstraction, and all existing consent, targeting, confirmation, and RBAC rules are reused.

Primary deliverables:

- Reopen, edit, revalidate, preview, and send a saved draft; sent alerts become immutable.
- One persisted failure notification per affected administrator per alert, with unread count and
  acknowledgement.
- Jurisdiction-scoped administrator alert history with combined filters, search, pagination, and
  failure counts.
- Resident personal alert history derived from the resident's own delivery records.
- Automatic one-year audit retention with a durable run outcome and concurrency guard.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20 LTS (backend); TypeScript 5.x with React 18
(frontend)

**Primary Dependencies**: Existing stack only: Express 4, Prisma ORM 6, PostgreSQL 15+,
JWT/bcrypt, Google Auth Library, Twilio SDK behind a provider abstraction, React 18, React Router 6,
Vite 5, Tailwind CSS 3, Jest 29, Supertest 7, Testing Library

**Storage**: PostgreSQL accessed through Prisma migrations. New tables store administrator failure
notifications and audit-retention run records; existing `Alert`, `DeliveryRecord`, `AlertTarget`,
`Administrator`, and `AuditEntry` tables are extended with relations/indexes only where required.

**Testing**: Jest + Supertest for backend unit, contract, and DB-backed integration tests;
Jest + Testing Library (jsdom) for frontend component tests; mock messaging provider for hermetic
delivery-failure scenarios; fake timers for scheduler and retention-boundary tests

**Target Platform**: Web application; modern browsers and a Linux Node.js server (Render/Railway),
with local development through `npm run dev`

**Project Type**: Web application with application source under `apps/backend/` and
`apps/frontend/`

**Performance Goals**: SC-004: administrator history first page and every filter combination return
in under 2 s for a locality with 10,000 alerts. Notification count and resident history first page
target under 500 ms with supporting indexes. Retention cleanup runs off the request path and must
not add noticeable latency to user requests.

**Constraints**: Single-locality, single-instance deployment assumption for the in-process
scheduler; server-side validation of every new query/body input; no new dependencies; reuse existing
RBAC and jurisdiction rules; timestamps stored in UTC and displayed locally by the browser; page
size bounded to 1-100; no out-of-app notification channels; no editing or resending after DRAFT.

**Scale/Scope**: One locality, multiple barangays, roughly 1,000 residents, 3-50 administrators,
10,000 alerts and their delivery records. Five user stories and 28 functional requirements.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate (Principle) | Requirement | Plan Compliance |
|------------------|-------------|-----------------|
| I. Code Quality First | Lint/static analysis, single-purpose modules, no dead code | ESLint + TypeScript `strict`; new backend code stays in the existing alerts/notifications/audit/residents modules; shared query parsing helpers avoid duplicated validation; frontend reuses a shared draft form |
| II. Test-Driven Development (NON-NEGOTIABLE) | Failing test before implementation; tests pass in CI | Each FR lands as Red-Green-Refactor: contract tests for endpoints, unit tests for query builders/outcome aggregation/retention, integration tests for fan-out and permissions, component tests for edit and history flows |
| III. Comprehensive Automated Testing | Unit + integration; deterministic/hermetic; coverage measured | Unit tests for pagination, filtering, notification audience, retention boundaries; Supertest contract/integration tests against the test database; mock provider triggers terminal failures; fake timers freeze retention time; coverage threshold unchanged |
| IV. Maintainability & Readability | Clear names, small units, documented interfaces | Dedicated `notifications` backend module; history query DTOs and typed response envelopes; OpenAPI delta contract; documented retention scheduler lifecycle and concurrency rule |
| V. Simplicity & Continuous Refactoring | YAGNI; continuous refactor; justify dependencies | No new libraries; offset pagination, a persisted notification table, and an in-process timer are the smallest designs meeting the requirements; existing `listAlerts` kept for the recent list instead of rewriting it |
| Quality Gates | Lint + static analysis + full test suite; review; coverage/vuln checks | Existing CI gates remain blocking; migration and new tests run in the same change; no dependency changes |
| Development Workflow | Small focused changes; tests+docs per change; releasable default branch | Work split by user story; contracts/data model/quickstart updated with implementation; existing broadcast and reporting tests must continue to pass (SC-008) |

**Result**: PASS. No violations and no complexity exceptions. The new notification and retention-run
tables are required for durability and auditability, not speculative generality.

## Project Structure

### Documentation (this feature)

```text
specs/002-complete-alert-operations/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI delta contract)
│   └── openapi.yaml
├── checklists/
│   └── requirements.md  # /speckit.specify output
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created here)
```

### Source Code (repository root)

All application source remains under `apps/`; the repository root holds configuration and docs
only.

```text
apps/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma                 # add FailureNotification, AuditRetentionRun, relations/indexes
│   │   └── migrations/                   # new migration for the two tables and indexes
│   ├── src/
│   │   ├── config/env.ts                 # optional retention interval configuration
│   │   ├── modules/
│   │   │   ├── alerts/
│   │   │   │   ├── alert.routes.ts        # add GET /admin/alerts/history before /:alertId
│   │   │   │   ├── alert.controller.ts    # parse history filters and paging
│   │   │   │   ├── alert.service.ts       # paged history, failure counts, atomic draft guards
│   │   │   │   └── alert.history.ts       # history query validation/builder (new)
│   │   │   ├── notifications/
│   │   │   │   ├── notification.routes.ts # admin notification list + acknowledge (new)
│   │   │   │   ├── notification.controller.ts
│   │   │   │   └── notification.service.ts # audience resolution, idempotent fan-out
│   │   │   ├── messaging/
│   │   │   │   └── dispatch.service.ts    # invoke failure fan-out after COMPLETED
│   │   │   ├── residents/
│   │   │   │   ├── resident.routes.ts     # add GET /residents/me/alert-history
│   │   │   │   ├── resident.controller.ts
│   │   │   │   └── resident.service.ts    # resident-scoped delivery history + outcome
│   │   │   └── audit/
│   │   │       ├── retention.job.ts       # persisted run wrapper + boundary purge
│   │   │       ├── retention.scheduler.ts # startup + daily interval guard (new)
│   │   │       └── audit.service.ts       # keep existing capped audit list unchanged
│   │   ├── app.ts                         # register notification router
│   │   └── server.ts                      # start/stop retention scheduler
│   └── tests/
│       ├── contract/                      # alert history, notifications, resident history
│       ├── integration/                   # failure fan-out, jurisdiction, concurrency
│       └── unit/                          # filters, outcome aggregation, retention/scheduler
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Layout.tsx                 # admin notification bell/unread count + history link
    │   │   ├── AlertForm.tsx              # shared create/edit form (extracted, new)
    │   │   └── Pagination.tsx             # shared pager (new)
    │   ├── pages/
    │   │   ├── admin/
    │   │   │   ├── AlertComposer.tsx      # use shared AlertForm for new drafts
    │   │   │   ├── AlertDetail.tsx        # edit mode for DRAFT, read-only afterwards
    │   │   │   ├── AlertHistory.tsx       # paged/filterable history (new)
    │   │   │   ├── Notifications.tsx      # notification history/acknowledge (new)
    │   │   │   └── AlertDeliveries.tsx    # reachable from notifications/history
    │   │   └── subscriber/
    │   │       ├── Announcements.tsx      # entry point to personal history
    │   │       └── AlertHistory.tsx       # resident personal history (new)
    │   ├── services/api.ts                # typed methods for new endpoints
    │   ├── types/                         # history, notification, paging DTOs
    │   └── App.tsx                        # routes for history, notifications, draft editing
    └── tests/
        └── components/                    # AlertForm, history filters, notification UI tests
```

**Structure Decision**: Continue the established web-application layout under `apps/`. Backend
changes reuse the existing modular routes -> controllers -> services -> Prisma structure. Failure
notification behavior gets its own module because both dispatch and administrator-facing endpoints
use it. The retention scheduler is split from the purge job so the purge remains a pure, testable
function. Frontend draft creation and editing share one `AlertForm` component; history screens use
one `Pagination` component and the existing typed API client.

## Key Design Decisions

- **History endpoint shape**: Add `GET /api/admin/alerts/history` returning
  `{ items, page, pageSize, total, totalPages, pageAdjusted, availableBarangays }`. The existing
  `GET /api/admin/alerts` stays unpaginated for the composer's recent list, avoiding a breaking
  contract change for feature 001. Because Express matches routes in order, the literal `history`
  route MUST be registered before `/admin/alerts/:alertId`.
- **Filtering**: Status, category, barangay, `from`, `to`, and case-insensitive content search are
  combined with AND. The barangay filter matches alerts with a target for that barangay or an
  all-barangay target (`barangayId: null`). Date inputs are ISO 8601 instants; the browser converts
  the locality's displayed day boundaries to UTC before sending.
- **Paging**: Offset pagination ordered by `createdAt DESC, id DESC` for stable ordering. The
  service clamps a page beyond the last page to the last valid page and sets `pageAdjusted` so the
  UI can explain the adjustment. Page size defaults to 20 with a maximum of 100.
- **Draft concurrency**: Draft saves use a conditional write guarded by `status = DRAFT`; the last
  successful save wins. Confirmation first claims the alert with
  `updateMany({ where: { id, status: DRAFT } })` inside a transaction, then re-reads the alert and
  resolves recipients from the claimed row. A save after a send fails with 409 `INVALID_STATE`; a
  send that loses to another send fails with 409. Re-reading after the claim guarantees the
  broadcast uses the latest committed draft values without an optimistic version token.
- **Failure notification identity**: One `FailureNotification` row per `(adminId, alertId)` with a
  unique constraint. Fan-out runs after dispatch reaches `COMPLETED`, only when at least one
  delivery is in terminal `FAILURE`. Retries that eventually succeed leave no failure record, so no
  notification is created.
- **Notification audience**: Active administrators who satisfy the same jurisdiction predicate as
  alert reads (SUPERADMIN/HIGH_LEVEL see all; LOW_LEVEL must have created the alert or have a target
  in their barangay). Repeated processing updates the existing row's failure count/time but never
  creates a duplicate.
- **Resident outcome**: Resident history is derived from the resident's `DeliveryRecord` rows,
  never from an ID supplied by the client. One entry per alert aggregates the resident's phones:
  any pending attempt => `PENDING`; all successes => `SUCCESS`; all failures => `FAILURE`;
  a mix of success and failure => `PARTIAL`.
- **Retention**: `purgeAuditEntries` keeps its strict `< cutoff` comparison, so an entry exactly 365
  days old is retained. A wrapper creates an `AuditRetentionRun` in `RUNNING`, updates it to
  `SUCCESS` with the removed count or `FAILED` with the error, and never lets an exception escape to
  the scheduler. The scheduler runs once shortly after startup and then every 24 hours, guarded by
  an in-process running flag. Multi-instance deployment would require a database lock; that is
  explicitly outside this feature's single-instance constraint.

## Complexity Tracking

> No Constitution Check violations. No complexity exceptions are required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | - | - |
