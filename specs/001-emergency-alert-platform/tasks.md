---

description: "Task list for Localized Emergency Alert & Reporting Platform"
---

# Tasks: Localized Emergency Alert & Reporting Platform

**Input**: Design documents from `/specs/001-emergency-alert-platform/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED — the project constitution (Principle II, Test-Driven Development, NON-NEGOTIABLE)
mandates a failing test before implementation. Test tasks are included per story and MUST be written
to fail first.

**Organization**: Tasks are grouped by user story so each story is independently implementable and
testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Every task includes an exact file path

## Path Conventions

All application source lives under `apps/` (per plan.md). Backend: `apps/backend/`. Frontend:
`apps/frontend/`. Repository root holds only repo-level config (`requests.http`,
`.github/workflows/`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the two-app workspace and tooling.

- [ ] T001 Create the workspace skeleton `apps/backend/` and `apps/frontend/` with the directory layout described in `specs/001-emergency-alert-platform/plan.md`
- [ ] T002 Initialize the backend Node.js 20 + Express + TypeScript project in `apps/backend/package.json` with dependencies (Express, Prisma, JWT, bcrypt, Twilio SDK, Jest, Supertest)
- [ ] T003 [P] Initialize the frontend React + TypeScript + Vite + Tailwind project in `apps/frontend/package.json`
- [ ] T004 [P] Add strict TypeScript configs in `apps/backend/tsconfig.json` and `apps/frontend/tsconfig.json`
- [ ] T005 [P] Configure ESLint + Prettier in `apps/backend/.eslintrc.cjs` and `apps/frontend/.eslintrc.cjs`
- [ ] T006 [P] Configure Jest + Supertest in `apps/backend/jest.config.ts` and component testing in `apps/frontend/jest.config.ts`
- [ ] T007 [P] Create environment templates with all variables from quickstart in `apps/backend/.env.example` and `apps/frontend/.env.example`
- [ ] T008 Create `requests.http` and `.github/workflows/ci.yml` (install, lint, typecheck, test, coverage threshold, dependency audit) at the repository root

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before any user story begins.

**CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T009 [P] Add Prisma schema with enums plus `Locality` and `Barangay` models and the initial migration in `apps/backend/prisma/schema.prisma`
- [ ] T010 [P] Implement environment/config loading (DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_ID, MESSAGING_PROVIDER, Twilio vars) in `apps/backend/src/config/env.ts`
- [ ] T011 [P] Implement the Prisma client singleton in `apps/backend/src/config/database.ts`
- [ ] T012 [P] Implement shared error handling and request-validation helpers (return `{ message, code?, details? }`) in `apps/backend/src/middleware/error.ts` and `apps/backend/src/middleware/validation.ts`
- [ ] T013 Implement JWT signing/verification and bcrypt password hashing in `apps/backend/src/modules/auth/token.ts`
- [ ] T014 Implement the authentication middleware that validates bearer tokens in `apps/backend/src/middleware/auth.ts`
- [ ] T015 Implement RBAC + jurisdiction-scope middleware (SUPERADMIN, HIGH_LEVEL, LOW_LEVEL, RESIDENT) in `apps/backend/src/middleware/rbac.ts`
- [ ] T016 [P] Implement the audit service and audit-writing middleware in `apps/backend/src/modules/audit/audit.service.ts` and `apps/backend/src/modules/audit/audit.middleware.ts`
- [ ] T017 [P] Implement the `MessagingProvider` interface with `MockProvider` and `TwilioProvider` (selected by `MESSAGING_PROVIDER`) in `apps/backend/src/modules/messaging/provider.ts`, `mock.provider.ts`, and `twilio.provider.ts`
- [ ] T018 Implement the Express app, router skeleton, and `GET /api/health` in `apps/backend/src/app.ts` and `apps/backend/src/server.ts`
- [ ] T019 [P] Implement the frontend typed API client, auth context, and routing shells in `apps/frontend/src/services/api.ts`, `apps/frontend/src/hooks/useAuth.tsx`, and `apps/frontend/src/App.tsx`
- [ ] T020 Create the seed script for one locality, multiple barangays, demo admins (all three roles), and demo residents with consent/phones in `apps/backend/prisma/seed.ts`
- [ ] T021 [P] Create the test-database reset helper and mock-messaging harness in `apps/backend/tests/helpers/db.ts` and `apps/backend/tests/helpers/messaging.ts`

**Checkpoint**: Foundation ready — user stories may begin.

---

## Phase 3: User Story 1 - Broadcast a Targeted Emergency Alert (Priority: P1) — MVP

**Goal**: An authorized administrator composes an alert, selects recipients by barangay/role,
reviews and confirms, and the system dispatches via the configured provider while recording a
delivery outcome per recipient.

**Independent Test**: With seeded subscribers only (no portal or reports), an admin can create and
confirm an alert targeting one barangay/role and see a delivery record for every intended recipient;
an empty target set is rejected; retries do not duplicate sends.

### Tests for User Story 1 (write first, ensure they FAIL)

- [ ] T022 [P] [US1] Contract tests for alert endpoints (`/api/admin/alerts`, `/recipients`, `/confirm`, `/deliveries`) in `apps/backend/tests/contract/alerts.contract.test.ts`
- [ ] T023 [P] [US1] Integration test for targeted recipient preview, broadcast, empty-target rejection, and retry duplicate-prevention in `apps/backend/tests/integration/alerts.broadcast.test.ts`

### Implementation for User Story 1

- [ ] T024 [P] [US1] Add `Alert`, `AlertTarget`, and `DeliveryRecord` Prisma models with enums (`AlertStatus`, `DeliveryStatus`) and a migration in `apps/backend/prisma/schema.prisma`
- [ ] T025 [P] [US1] Implement the recipient eligibility/resolution service (active resident + granted consent + target match + category opt-in + at least one phone) in `apps/backend/src/modules/alerts/recipient.service.ts`
- [ ] T026 [P] [US1] Implement the dispatch service with bounded retry, status tracking, and a unique `idempotencyKey` per delivery in `apps/backend/src/modules/messaging/dispatch.service.ts`
- [ ] T027 [US1] Implement the alert service (create/update DRAFT, confirm with recipient recomputation, record deliveries) in `apps/backend/src/modules/alerts/alert.service.ts`
- [ ] T028 [US1] Implement alert routes/controllers for list, create, get, patch, recipient preview, confirm, and deliveries in `apps/backend/src/modules/alerts/alert.routes.ts` and `apps/backend/src/modules/alerts/alert.controller.ts`
- [ ] T029 [US1] Record audit entries for alert creation and broadcast confirmation in `apps/backend/src/modules/alerts/alert.service.ts`
- [ ] T030 [P] [US1] Build the admin alert composer with message, targets, recipient preview, and explicit confirmation in `apps/frontend/src/pages/admin/AlertComposer.tsx`
- [ ] T031 [P] [US1] Build the per-recipient delivery status view in `apps/frontend/src/pages/admin/AlertDeliveries.tsx`

**Checkpoint**: User Story 1 is fully functional and independently testable (MVP).

---

## Phase 4: User Story 2 - Register and Use a Subscriber Portal (Priority: P2)

**Goal**: A resident signs in with Google, maintains profile/phones/consent/preferences, and views
area announcements and personal history.

**Independent Test**: A resident can register, set barangay/role/building, grant consent, link a
second phone, opt out of a category, and view announcements/history — with no report features.

### Tests for User Story 2 (write first, ensure they FAIL)

- [ ] T032 [P] [US2] Contract tests for auth and resident endpoints (`/api/auth/resident/google`, `/api/residents/me`, `/phones`, `/consent`, `/preferences`, `/announcements`) in `apps/backend/tests/contract/residents.contract.test.ts`
- [ ] T033 [P] [US2] Integration test for registration, profile update, phone linking, consent, preferences, and announcement visibility in `apps/backend/tests/integration/residents.portal.test.ts`

### Implementation for User Story 2

- [ ] T034 [P] [US2] Add `Resident`, `PhoneNumber`, `Consent`, and `AlertPreference` Prisma models with `ResidentRole` enum and a migration in `apps/backend/prisma/schema.prisma`
- [ ] T035 [P] [US2] Implement Google ID-token verification and resident session issuance in `apps/backend/src/modules/auth/google.ts`
- [ ] T036 [US2] Implement the resident profile/phone/consent/preferences service (E.164 phone normalization, single primary number, consent recorded with policy version) in `apps/backend/src/modules/residents/resident.service.ts`
- [ ] T037 [US2] Implement resident routes/controllers for profile, phones, consent, preferences, announcements, and own reports in `apps/backend/src/modules/residents/resident.routes.ts` and `apps/backend/src/modules/residents/resident.controller.ts`
- [ ] T038 [US2] Integrate consent, category opt-out, and phone checks into recipient eligibility in `apps/backend/src/modules/alerts/recipient.service.ts` (extends T025)
- [ ] T039 [P] [US2] Build subscriber registration, profile, consent, and preference pages in `apps/frontend/src/pages/subscriber/`
- [ ] T040 [P] [US2] Build the announcements and alert-history view in `apps/frontend/src/pages/subscriber/Announcements.tsx`

**Checkpoint**: User Stories 1 and 2 work independently.

---

## Phase 5: User Story 3 - Submit and Triage Local Emergency Reports (Priority: P2)

**Goal**: Residents submit categorized/severity-rated reports with location; authorized admins triage
through the lifecycle and high-level admins can escalate a report into a draft alert.

**Independent Test**: A resident submits a valid report that appears as NEW to the correct
jurisdiction admin, who can acknowledge/resolve/dismiss it; a low-level admin cannot access another
barangay's reports; a high-level admin can escalate to a draft alert.

### Tests for User Story 3 (write first, ensure they FAIL)

- [ ] T041 [P] [US3] Contract tests for report endpoints (`POST /api/reports`, `/api/residents/me/reports`, `/api/admin/reports`, `/{id}`, `/status`, `/escalate`) in `apps/backend/tests/contract/reports.contract.test.ts`
- [ ] T042 [P] [US3] Integration test for submission (NEW), lifecycle transitions, jurisdiction denial, and escalation in `apps/backend/tests/integration/reports.triage.test.ts`

### Implementation for User Story 3

- [ ] T043 [P] [US3] Add `EmergencyReport` and `ReportStatusHistory` Prisma models with category/severity/status enums and a migration in `apps/backend/prisma/schema.prisma` (description max 500, location required as lat/lng or address text)
- [ ] T044 [P] [US3] Implement report validation (category enum: Fire/Flood/Medical/Security Threat/Power Outage/Infrastructure Damage/Other; severity: Low/Medium/High/Critical; description ≤ 500 characters; at least one of lat+lng or address) in `apps/backend/src/modules/reports/report.validation.ts`
- [ ] T045 [US3] Implement the report service (submit as NEW, jurisdiction-scoped listing, allowed status transitions, escalation to a DRAFT alert) in `apps/backend/src/modules/reports/report.service.ts`
- [ ] T046 [US3] Implement report routes/controllers for submit, own-list, admin list/get, status update, and escalate in `apps/backend/src/modules/reports/report.routes.ts` and `apps/backend/src/modules/reports/report.controller.ts`
- [ ] T047 [US3] Record audit entries and status-history rows for report transitions and escalation in `apps/backend/src/modules/reports/report.service.ts`
- [ ] T048 [P] [US3] Build the subscriber report submission form (category, severity, description counter ≤500, location) in `apps/frontend/src/pages/subscriber/ReportForm.tsx`
- [ ] T049 [P] [US3] Build the admin report triage list/detail with status actions and escalation in `apps/frontend/src/pages/admin/ReportTriage.tsx`

**Checkpoint**: User Stories 1, 2, and 3 work independently.

---

## Phase 6: User Story 4 - Administer Roles and Enforce Access Boundaries (Priority: P3)

**Goal**: Superadmin manages administrator accounts and roles; jurisdiction restrictions are enforced
across all data; critical actions are auditable.

**Independent Test**: A superadmin creates HIGH_LEVEL and LOW_LEVEL accounts; a LOW_LEVEL admin is
denied access outside their barangay; role changes and broadcasts appear in the audit trail.

### Tests for User Story 4 (write first, ensure they FAIL)

- [ ] T050 [P] [US4] Contract tests for administrator and audit endpoints (`/api/admin/administrators`, `/{id}`, `/api/admin/audit`) in `apps/backend/tests/contract/admins.contract.test.ts`
- [ ] T051 [P] [US4] Integration test for account creation, role-barangay consistency, cross-barangay denial, and audit recording/retrieval in `apps/backend/tests/integration/admins.rbac.test.ts`

### Implementation for User Story 4

- [ ] T052 [P] [US4] Add the `Administrator` Prisma model with `AdminRole` enum and a migration in `apps/backend/prisma/schema.prisma` (LOW_LEVEL requires barangayId; SUPERADMIN barangayId null)
- [ ] T053 [US4] Implement the administrator account service (create/update, role-barangay consistency, bcrypt hashing, deactivation) in `apps/backend/src/modules/admins/admin.service.ts`
- [ ] T054 [US4] Implement administrator routes/controllers in `apps/backend/src/modules/admins/admin.routes.ts` and `apps/backend/src/modules/admins/admin.controller.ts`
- [ ] T055 [US4] Implement the audit query endpoint (filters: entityType, from, to) and controller in `apps/backend/src/modules/audit/audit.routes.ts` and `apps/backend/src/modules/audit/audit.controller.ts`
- [ ] T056 [US4] Enforce jurisdiction scoping across alert and report queries in `apps/backend/src/modules/alerts/alert.service.ts` and `apps/backend/src/modules/reports/report.service.ts` (extends T027, T045)
- [ ] T057 [P] [US4] Build the admin account management page in `apps/frontend/src/pages/admin/AdminAccounts.tsx`
- [ ] T058 [P] [US4] Build the audit log viewer with filters in `apps/frontend/src/pages/admin/AuditLog.tsx`

**Checkpoint**: All four user stories work independently.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Cross-cutting hardening, documentation, and validation.

- [ ] T059 [P] Add the audit-retention cleanup job (delete entries older than 365 days) in `apps/backend/src/modules/audit/retention.job.ts`
- [ ] T060 [P] Harden security: strict CORS allowlist, security headers, secret-safe logging, and confirmation-gated broadcast review in `apps/backend/src/app.ts` and `apps/backend/src/config/env.ts`
- [ ] T061 [P] Document run/API usage in `README.md`, `apps/backend/README.md`, and `apps/frontend/README.md`
- [ ] T062 Run all `specs/001-emergency-alert-platform/quickstart.md` scenarios V1–V6 and record results in `specs/001-emergency-alert-platform/validation.md`
- [ ] T063 [P] Add a performance smoke test with 1,000 seeded residents in `apps/backend/tests/integration/performance.smoke.test.ts`
- [ ] T064 Code cleanup and refactor pass across `apps/backend/src` and `apps/frontend/src` (no dead code, no duplicated logic)
- [ ] T065 [P] Verify the CI pipeline passes lint, typecheck, test, coverage threshold, and dependency audit in `.github/workflows/ci.yml`
- [ ] T066 Verify constitution compliance (failing-test-first evidence, coverage ≥ threshold, no direct DB access by admins, no application source at repo root) and record it in `specs/001-emergency-alert-platform/compliance.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — starts immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phase 3–6)**: All depend on Foundational completion.
- **Polish (Phase 7)**: Depends on the desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependency on other stories.
- **US2 (P2)**: After Foundational — independently testable; T038 extends US1's recipient service (T025), so run after T025 if both are in progress.
- **US3 (P2)**: After Foundational — independently testable; escalation (T045) creates a DRAFT alert and therefore depends on US1's alert service (T027).
- **US4 (P3)**: After Foundational — independently testable; T056 scopes US1 and US3 queries (T027, T045).

### Within Each User Story

- Tests (T0xx pairs) MUST be written and FAIL before implementation.
- Models → services → routes/controllers → frontend.
- Core implementation before cross-story integration.

### Parallel Opportunities

- All Setup `[P]` tasks can run in parallel after T001–T002.
- All Foundational `[P]` tasks can run in parallel.
- After Foundational, US1–US4 can proceed in parallel (subject to the cross-story notes above).
- Within a story, contract and integration tests `[P]` run together; models `[P]` run together.
- Frontend `[P]` tasks for a story can run alongside backend work (different files).

---

## Parallel Example: User Story 1

```bash
# Tests first (both should fail):
Task: "Contract tests for alert endpoints in apps/backend/tests/contract/alerts.contract.test.ts"
Task: "Integration test for targeted broadcast in apps/backend/tests/integration/alerts.broadcast.test.ts"

# Models and services that touch different files:
Task: "Add Alert/AlertTarget/DeliveryRecord models in apps/backend/prisma/schema.prisma"
Task: "Implement recipient eligibility service in apps/backend/src/modules/alerts/recipient.service.ts"
Task: "Implement dispatch service with retry/idempotency in apps/backend/src/modules/messaging/dispatch.service.ts"

# Frontend alongside backend:
Task: "Build admin alert composer in apps/frontend/src/pages/admin/AlertComposer.tsx"
Task: "Build delivery status view in apps/frontend/src/pages/admin/AlertDeliveries.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: Run quickstart V1 and V2; confirm delivery records and duplicate prevention.
5. Demo/deploy the MVP.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 → validate → demo (MVP).
3. US2 → validate → demo (subscriber self-service).
4. US3 → validate → demo (reports and triage).
5. US4 → validate → demo (administration and audit).
6. Polish → full quickstart validation and CI green.

### Parallel Team Strategy

1. Team completes Setup + Foundational together.
2. Then: Developer A → US1; Developer B → US2; Developer C → US3; Developer D → US4.
3. Respect cross-story notes (T038 after T025; T045 after T027; T056 after T027/T045).

---

## Notes

- `[P]` = different files, no dependencies on incomplete tasks.
- `[Story]` maps a task to its user story for traceability.
- Each user story is independently completable and testable.
- Verify tests fail before implementing (Constitution Principle II).
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently.
- Avoid vague tasks, same-file conflicts, and cross-story dependencies that break independence.
