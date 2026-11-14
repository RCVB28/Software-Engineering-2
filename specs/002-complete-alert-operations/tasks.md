---

description: "Task list for Alert Operations Completion"
---

# Tasks: Alert Operations Completion

**Input**: Design documents from `/specs/002-complete-alert-operations/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED - the project constitution (Principle II, Test-Driven Development, NON-NEGOTIABLE)
mandates a failing test before implementation. Test tasks are included per story and MUST be written
to fail for the expected reason before production code is added.

**Organization**: Tasks are grouped by user story so each story is independently implementable and
testable. Shared schema, validation, and paging work lives in the Foundational phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1-US5)
- Every task includes an exact file path

## Path Conventions

All application source lives under `apps/` (per plan.md). Backend: `apps/backend/`. Frontend:
`apps/frontend/`. Feature documentation lives under `specs/002-complete-alert-operations/`.
Repository root holds only repo-level configuration (`requests.http`, `README.md`, CI).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the shared types and documented settings used across the new screens and the
retention job.

- [X] T001 [P] Add shared frontend DTOs for `PageMetadata`, `AlertHistoryItem`, `AlertHistoryPage`, `FailureNotification`, `FailureNotificationPage`, `ResidentDeliveryOutcome`, `ResidentAlertHistoryItem`, and `ResidentAlertHistoryPage` to `apps/frontend/src/types/index.ts`; include `updatedAt` on the existing `Alert` type and the `PENDING | SUCCESS | FAILURE | PARTIAL` outcome union
- [X] T002 [P] Document `AUDIT_RETENTION_INTERVAL_MS` (default `86400000`, minimum `60000`) and `AUDIT_RETENTION_STARTUP_DELAY_MS` (default `5000`) in `apps/backend/.env.example` and the environment table in `apps/backend/README.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, shared validation, paging UI, and test harness support required by all user
stories.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Extend `apps/backend/prisma/schema.prisma` and create a migration in `apps/backend/prisma/migrations/` with `FailureNotification` (`id`, required `adminId` and `alertId`, `failureCount` greater than zero, required `completedAt`, nullable `readAt`, timestamps; unique `(adminId, alertId)`; indexes `(adminId, readAt)`, `(alertId)`, `(adminId, createdAt)`), `AuditRetentionRun` (`RetentionRunStatus` enum `RUNNING | SUCCESS | FAILED`, `startedAt`, nullable `finishedAt`, `removedCount` default `0`, nullable `error`, `createdAt`; index `(startedAt)`), inverse relations on `Administrator` and `Alert`, and indexes `Alert(createdAt)`, `Alert(status)`, `Alert(category)`, `Alert(createdByAdminId)`, `DeliveryRecord(alertId, status)`, `DeliveryRecord(residentId)`, `AlertTarget(barangayId)`
- [X] T004 Update `apps/backend/tests/helpers/db.ts` so `resetDatabase()` deletes `failureNotification` before `alert`/`administrator` and `auditRetentionRun` before the remaining tables, keeping foreign-key order valid
- [X] T005 [P] Write failing unit tests in `apps/backend/tests/unit/query.validation.test.ts` for shared query parsing: `page` integer >= 1 default 1; `pageSize` integer 1-100 default 20; optional `status`/`category` enum validation; ISO 8601 `from`/`to` with `from <= to`; trimmed `q` of 1-200 characters; invalid values return a 400 `VALIDATION_ERROR`
- [X] T006 Implement the shared query parsers in `apps/backend/src/middleware/query.ts` to satisfy T005, reusing `AppError` and the existing validation style
- [X] T007 [P] Write a failing frontend component test in `apps/frontend/tests/components/Pagination.test.tsx` for rendering the current/last page, disabling previous/next at bounds, and emitting the requested page
- [X] T008 Implement the shared `Pagination` component in `apps/frontend/src/components/Pagination.tsx` to satisfy T007

**Checkpoint**: Schema and shared helpers are ready; user stories may begin.

---

## Phase 3: User Story 1 - Reopen and Edit a Saved Draft (Priority: P1) - MVP

**Goal**: An administrator reopens a saved draft, edits every editable field, saves, previews, and
sends it. Sent alerts are immutable, and concurrent edits/sends cannot corrupt the draft.

**Independent Test**: Save a draft, navigate away, reopen it, change message/category/targets, save,
reload, and verify persistence; preview and send; then verify PATCH returns 409 and the alert is
unchanged.

### Tests for User Story 1

> Write these tests FIRST and confirm they fail before T012-T014.

- [X] T009 [P] [US1] Write failing contract tests in `apps/backend/tests/contract/alerts.draft-edit.test.ts` covering reopen of saved values, PATCH persistence of content/category/targets, preview reflecting saved values, 409 `INVALID_STATE` after confirm with the row unchanged, 400 for content over 480 characters or invalid/empty targets, and 403 for a LOW_LEVEL draft outside the admin's barangay
- [X] T010 [P] [US1] Write failing integration tests in `apps/backend/tests/integration/alerts.draft-concurrency.test.ts` covering two concurrent saves (last successful save wins), save-after-confirm returning 409, confirm using the latest committed values, and a confirm with no eligible recipients leaving the alert in DRAFT
- [X] T011 [P] [US1] Write a failing frontend test in `apps/frontend/tests/components/AlertForm.test.tsx` covering prefilled content/category/targets for an existing draft, validation of empty content/targets, emitted save payload, and read-only rendering once the alert is no longer DRAFT

### Implementation for User Story 1

- [X] T012 [US1] Update `updateDraft` and `confirmAlert` in `apps/backend/src/modules/alerts/alert.service.ts`: save with a conditional `status = DRAFT` update inside a transaction and replace targets atomically; confirm claims the alert with `updateMany({ where: { id, status: DRAFT } })` inside a transaction, re-reads the alert and targets, resolves recipients against the claimed row, rolls back when no recipients exist, records the audit entry after success, and dispatches the latest committed content
- [X] T013 [P] [US1] Extract the create/edit form from `apps/frontend/src/pages/admin/AlertComposer.tsx` into `apps/frontend/src/components/AlertForm.tsx` (content limited to 480 characters, category select, target rows requiring a barangay or role) and refactor the composer to use it without changing its create/preview/send behavior
- [X] T014 [US1] Add DRAFT edit mode to `apps/frontend/src/pages/admin/AlertDetail.tsx` using `AlertForm`: prefill from the loaded alert, save through `PATCH /api/admin/alerts/{alertId}`, refresh saved values and invalidate the recipient preview after save, show 409 errors clearly, and render the alert read-only for non-DRAFT statuses

**Checkpoint**: User Story 1 is independently functional and testable.

---

## Phase 4: User Story 2 - See Failed Deliveries Without Opening Every Alert (Priority: P1)

**Goal**: After a broadcast completes with terminal failures, each authorized administrator gets
one persisted in-app notification with the alert, category, failure count, and completion time; the
notification can be acknowledged and survives reload.

**Independent Test**: Broadcast with one permanent failure; verify exactly one notification per
authorized administrator, no notification for retry-success or out-of-scope low-level admins, no
duplicate on reprocessing, and unread count decreases after acknowledgement while history remains.

### Tests for User Story 2

> Write these tests FIRST and confirm they fail before T020-T025.

- [X] T015 [P] [US2] Write failing unit tests in `apps/backend/tests/unit/notification.service.test.ts` for terminal-failure counting (only `FAILURE`, not `DELAYED` or retried successes), audience resolution (active SUPERADMIN/HIGH_LEVEL see all; LOW_LEVEL only creator or target barangay; inactive excluded), and idempotent upsert behavior
- [X] T016 [P] [US2] Write failing integration tests in `apps/backend/tests/integration/notifications.fanout.test.ts` covering all-success => zero notifications, retry-success => zero, permanent failure => one per eligible admin with correct `failureCount`/`completedAt`, repeated processing => no duplicate, and LOW_LEVEL outside the target barangay => zero
- [X] T017 [P] [US2] Write failing contract tests in `apps/backend/tests/contract/notifications.contract.test.ts` covering `GET /api/admin/notifications` paging/envelope/`unreadCount`/`unreadOnly`, `POST /api/admin/notifications/{notificationId}/acknowledge` idempotency and unread-count decrease, acknowledged rows remaining in history, 404 for unknown or another admin's notification, and 401/403 for unauthenticated/non-admin callers
- [X] T018 [P] [US2] Write a failing frontend test in `apps/frontend/tests/components/NotificationBell.test.tsx` covering unread badge count, opening the notification list, acknowledging a notification, and the zero-unread state
- [X] T019 [P] [US2] Write a failing frontend test in `apps/frontend/tests/components/NotificationsPage.test.tsx` covering notification history fields, acknowledgement, alert-delivery links, and the empty state

### Implementation for User Story 2

- [X] T020 [US2] Implement `apps/backend/src/modules/notifications/notification.service.ts` with `fanOutFailureNotifications(prisma, alertId, completedAt)` (count `FAILURE` deliveries, resolve the audience, upsert one row per `(adminId, alertId)` with refreshed `failureCount`/`completedAt`), `listFailureNotifications(prisma, adminId, filters)` (paged, optional `unreadOnly`, total unread count), and `acknowledgeNotification(prisma, adminId, notificationId)` (404 when not owned, idempotent `readAt`)
- [X] T021 [US2] Call the failure fan-out from `apps/backend/src/modules/messaging/dispatch.service.ts` after the alert reaches `COMPLETED`, passing the completion timestamp; keep the existing idempotency key and retry behavior unchanged
- [X] T022 [US2] Add `apps/backend/src/modules/notifications/notification.controller.ts` and `apps/backend/src/modules/notifications/notification.routes.ts` for `GET /api/admin/notifications` and `POST /api/admin/notifications/{notificationId}/acknowledge`, then register the router in `apps/backend/src/app.ts`
- [X] T023 [US2] Add typed `api.notifications.list` and `api.notifications.acknowledge` methods in `apps/frontend/src/services/api.ts` using the shared paging/notification DTOs from T001
- [X] T024 [US2] Implement `apps/frontend/src/components/NotificationBell.tsx` and integrate it into the admin header in `apps/frontend/src/components/Layout.tsx`: fetch on mount, when opened, after acknowledgement, and on a cleaned-up 30-second interval; link each notification to `/admin/alerts/{alertId}/deliveries`
- [X] T025 [US2] Implement the notification history page in `apps/frontend/src/pages/admin/Notifications.tsx`, add its route to `apps/frontend/src/App.tsx`, link it from the bell, and render acknowledgement plus delivery-result navigation

**Checkpoint**: User Stories 1 and 2 are independently functional and testable.

---

## Phase 5: User Story 3 - Browse and Filter Administrative Alert History (Priority: P2)

**Goal**: An administrator browses a complete newest-first alert history with combined filters,
message search, stable pagination, failure counts, and jurisdiction-safe options.

**Independent Test**: With more than one page of alerts, apply each filter and combination, page
through results without duplicates/skips, verify page clamping and empty states, and confirm
LOW_LEVEL admins only see and filter by their barangay.

### Tests for User Story 3

> Write these tests FIRST and confirm they fail before T029-T032.

- [X] T026 [P] [US3] Write failing unit tests in `apps/backend/tests/unit/alert.history.test.ts` for the history query builder: defaults and clamping, stable `createdAt DESC, id DESC` order, ANDed status/category/barangay/date/`q` filters, barangay filter matching a named target or an all-barangay target, LOW_LEVEL scope, and invalid inputs returning 400
- [X] T027 [P] [US3] Write failing contract tests in `apps/backend/tests/contract/alerts.history.test.ts` covering newest-first fields (message, category, status, targets, creation/send time, `failureCount`), each filter and a combined filter, 10-page stability without duplicates/omissions, `pageAdjusted`/last-valid-page behavior, empty results, LOW_LEVEL result/filter scoping through `availableBarangays`, and 401/403
- [X] T028 [P] [US3] Write a failing frontend test in `apps/frontend/tests/components/AlertHistory.test.tsx` covering filter application, filters remaining active across page changes, total/empty states with reset, and draft versus completed row links

### Implementation for User Story 3

- [X] T029 [US3] Implement `apps/backend/src/modules/alerts/alert.history.ts` (validate/parse query, compose the jurisdiction + filter `Prisma.AlertWhereInput`, map `availableBarangays`) and add `listAlertHistory` to `apps/backend/src/modules/alerts/alert.service.ts` with filtered `FAILURE` relation counts, stable order, offset paging, `totalPages`, and page clamping
- [X] T030 [US3] Add the history controller handler in `apps/backend/src/modules/alerts/alert.controller.ts` and register `GET /api/admin/alerts/history` in `apps/backend/src/modules/alerts/alert.routes.ts` before `GET /api/admin/alerts/:alertId` so the literal route wins
- [X] T031 [US3] Add a typed `api.alerts.history(filters)` method in `apps/frontend/src/services/api.ts` that serializes only provided filters and preserves ISO `from`/`to` instants
- [X] T032 [US3] Implement `apps/frontend/src/pages/admin/AlertHistory.tsx` with all filters, message search, result count, paging via `Pagination`, empty/reset state, and draft/completed links; add its route and admin navigation entry in `apps/frontend/src/App.tsx` and `apps/frontend/src/components/Layout.tsx`, and add a "View all history" link beside the recent list in `apps/frontend/src/pages/admin/AlertComposer.tsx`

**Checkpoint**: User Story 3 is independently functional and testable.

---

## Phase 6: User Story 4 - Review Personal Alert History (Priority: P2)

**Goal**: A resident views only their own alerts, newest first, with category, message, send time,
and aggregated delivery outcome, paged with pending support.

**Independent Test**: Deliver alerts to two residents with different outcomes; verify each sees
only their own entries, correct ordering/outcomes/paging, a pending entry updates to final, and a
cross-resident request is impossible.

### Tests for User Story 4

> Write these tests FIRST and confirm they fail before T036-T039.

- [X] T033 [P] [US4] Write failing unit tests in `apps/backend/tests/unit/resident.history.test.ts` for outcome aggregation (`PENDING` when any `SUBMITTED`/`DELAYED`; `SUCCESS` when all succeed; `FAILURE` when all fail; `PARTIAL` for a success/failure mix), `sentAt` fallback, and page clamping
- [X] T034 [P] [US4] Write failing contract tests in `apps/backend/tests/contract/residents.alert-history.test.ts` covering personal-only results, newest-first ordering, unique items across paging, pending-to-final outcome, empty state, and denial of cross-resident or admin access
- [X] T035 [P] [US4] Write a failing frontend test in `apps/frontend/tests/components/ResidentAlertHistory.test.tsx` covering outcome labels, send time/message rendering, paging, pending state, and the empty state

### Implementation for User Story 4

- [X] T036 [US4] Implement `listResidentAlertHistory(prisma, residentId, page, pageSize)` in `apps/backend/src/modules/residents/resident.service.ts`: alerts with at least one delivery for the authenticated resident, only that resident's delivery statuses included, one aggregate outcome per alert, `sentAt = confirmedAt ?? createdAt`, stable `createdAt DESC, id DESC`, and clamped offset paging
- [X] T037 [US4] Add the resident history controller handler in `apps/backend/src/modules/residents/resident.controller.ts` and register `GET /api/residents/me/alert-history` in `apps/backend/src/modules/residents/resident.routes.ts` behind the existing resident authentication/RBAC
- [X] T038 [US4] Add a typed `api.residents.alertHistory(page)` method in `apps/frontend/src/services/api.ts`
- [X] T039 [US4] Implement `apps/frontend/src/pages/subscriber/AlertHistory.tsx`, add its route and resident navigation entry in `apps/frontend/src/App.tsx` and `apps/frontend/src/components/Layout.tsx`, and add a link from `apps/frontend/src/pages/subscriber/Announcements.tsx`

**Checkpoint**: User Story 4 is independently functional and testable.

---

## Phase 7: User Story 5 - Automatic One-Year Audit Retention (Priority: P3)

**Goal**: Audit entries older than 365 days are removed automatically at least daily, entries within
the window are retained, runs are idempotent and failure-safe, and each outcome is persisted for
operators.

**Independent Test**: Seed expired, exactly-365-day, and newer entries; run cleanup twice and verify
only expired entries are removed, the run row records success/count, a failure row records the
reason without crashing, and the scheduler invokes runs on startup and at the configured interval.

### Tests for User Story 5

> Write these tests FIRST and confirm they fail before T043-T044.

- [X] T040 [P] [US5] Expand `apps/backend/tests/unit/audit.retention.test.ts` with failing tests for the strict `< cutoff` boundary (exactly 365 days retained), idempotent repeated purges, `AuditRetentionRun` creation in RUNNING followed by SUCCESS with `removedCount`, and FAILED with an error summary when the purge throws
- [X] T041 [P] [US5] Write failing unit tests in `apps/backend/tests/unit/audit.scheduler.test.ts` using fake timers for the startup delay, daily interval, overlapping-run guard, timer cleanup/`unref`, and a failed run being swallowed/logged so the scheduler continues
- [X] T042 [P] [US5] Write failing DB-backed integration tests in `apps/backend/tests/integration/audit.retention.test.ts` that seed entries older than, exactly at, and newer than the cutoff, run retention twice, and verify deletions, retained boundary rows, and persisted run outcomes

### Implementation for User Story 5

- [X] T043 [US5] Implement `runAuditRetention` in `apps/backend/src/modules/audit/retention.job.ts`: create the RUNNING row, call `purgeAuditEntries` with the 365-day cutoff, update SUCCESS with `finishedAt`/`removedCount`, or update FAILED with `finishedAt`/non-secret `error` and log without rethrowing; keep `createdAt < cutoff` so entries exactly 365 days old are retained
- [X] T044 [US5] Implement `apps/backend/src/modules/audit/retention.scheduler.ts` with injectable run/interval/startup options, an in-process overlap guard, `unref`'d timers, and cleanup; add validated `AUDIT_RETENTION_INTERVAL_MS` (default 86400000, minimum 60000) and `AUDIT_RETENTION_STARTUP_DELAY_MS` (default 5000) to `apps/backend/src/config/env.ts`; start the scheduler after the server listens and stop it during shutdown in `apps/backend/src/server.ts`

**Checkpoint**: All five user stories are independently functional and testable.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, performance validation, refactoring, and final quality gates.

- [X] T045 [P] Add examples for draft edit, alert history filters, notification list/acknowledge, and resident alert history to `requests.http`
- [X] T046 [P] Update `README.md` to reference feature 002 docs and update `apps/backend/README.md` with the notification flow, retention scheduler, and automatic retention behavior
- [X] T047 [P] Add a DB-backed performance assertion to `apps/backend/tests/integration/performance.smoke.test.ts` that seeds 10,000 alerts and asserts the history first page and representative filter combinations return within 2 seconds
- [X] T048 [P] Extract the duplicated target-description logic from `apps/frontend/src/pages/admin/AlertComposer.tsx` and `apps/frontend/src/pages/admin/AlertDetail.tsx` into a tested helper in `apps/frontend/src/components/format.ts`, updating `apps/frontend/tests/components/format.test.ts` first
- [X] T049 Run the full quality gates from `README.md` (backend lint/typecheck/test/coverage with `RUN_DB_TESTS=1`, frontend lint/typecheck/test), execute quickstart scenarios V1-V6, fix any failures, and record the results in `specs/002-complete-alert-operations/validation.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; T001 and T002 can run in parallel.
- **Foundational (Phase 2)**: Depends on Setup. T003 (schema/migration) precedes T004. T005 -> T006 and T007 -> T008 are independent pairs.
- **User Stories (Phase 3+)**: All depend on Foundational completion. In priority order: US1 -> US2 -> US3 -> US4 -> US5. US2, US4, and US5 are largely independent, but shared files make sequential delivery safest.
- **Polish (Phase 8)**: Depends on every desired user story.

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories; uses the existing alert endpoints and shared `AlertForm`.
- **US2 (P1)**: Needs the schema from T003 and the notification fan-out in dispatch; independent of US1.
- **US3 (P2)**: Needs the query/paging helpers from T005-T008; independent of US1/US2 behavior.
- **US4 (P2)**: Needs the query/paging helpers from T005-T008; independent of US1-US3 behavior.
- **US5 (P3)**: Needs the `AuditRetentionRun` schema from T003; independent of all other stories.

### Critical Shared Files

- `apps/backend/src/modules/alerts/alert.service.ts` is changed by US1 (T012) and US3 (T029). Deliver US1 first or coordinate the two changes.
- `apps/frontend/src/services/api.ts` is changed by US2, US3, and US4; apply those edits sequentially.
- `apps/frontend/src/App.tsx` and `apps/frontend/src/components/Layout.tsx` are changed by US2, US3, and US4; apply those edits sequentially.
- `apps/backend/src/app.ts` is changed by US2 (notification router); `apps/backend/src/server.ts` by US5.

### Within Each User Story

- Write the tests first and confirm they fail for the expected reason.
- Backend service before controller/routes; frontend API method before page/component wiring.
- The story is complete when its independent test criteria and targeted suites pass.

### Parallel Opportunities

- Setup: T001 and T002.
- Foundational: T005/T006 can run alongside T007/T008 after T003/T004.
- US1: T009/T010/T011 in parallel; T012 and T013 in parallel; T014 after T013.
- US2: T015-T019 in parallel; T020 and T023 in parallel; T021/T022 after T020; T024/T025 after T023 (keep Layout/App edits sequential).
- US3: T026-T028 in parallel; T029 and T031 in parallel; T030 after T029; T032 after T030/T031.
- US4: T033-T035 in parallel; T036 and T038 in parallel; T037 after T036; T039 after T037/T038.
- US5: T040-T042 in parallel; T043 after T040; T044 after T041/T043.
- Polish: T045-T048 in parallel; T049 last.

---

## Parallel Example: User Story 1

```text
Task: "Write failing contract tests in apps/backend/tests/contract/alerts.draft-edit.test.ts"
Task: "Write failing integration tests in apps/backend/tests/integration/alerts.draft-concurrency.test.ts"
Task: "Write failing frontend test in apps/frontend/tests/components/AlertForm.test.tsx"

# After the backend test fails for the expected reason:
Task: "Update updateDraft/confirmAlert in apps/backend/src/modules/alerts/alert.service.ts"
Task: "Extract AlertForm in apps/frontend/src/components/AlertForm.tsx"
```

## Parallel Example: User Story 2

```text
Task: "Write failing unit tests in apps/backend/tests/unit/notification.service.test.ts"
Task: "Write failing integration tests in apps/backend/tests/integration/notifications.fanout.test.ts"
Task: "Write failing contract tests in apps/backend/tests/contract/notifications.contract.test.ts"
Task: "Write failing NotificationBell tests in apps/frontend/tests/components/NotificationBell.test.tsx"
Task: "Write failing Notifications page tests in apps/frontend/tests/components/NotificationsPage.test.tsx"
```

## Parallel Example: User Story 3

```text
Task: "Write failing unit tests in apps/backend/tests/unit/alert.history.test.ts"
Task: "Write failing contract tests in apps/backend/tests/contract/alerts.history.test.ts"
Task: "Write failing frontend test in apps/frontend/tests/components/AlertHistory.test.tsx"
```

## Parallel Example: User Story 4

```text
Task: "Write failing unit tests in apps/backend/tests/unit/resident.history.test.ts"
Task: "Write failing contract tests in apps/backend/tests/contract/residents.alert-history.test.ts"
Task: "Write failing frontend test in apps/frontend/tests/components/ResidentAlertHistory.test.tsx"
```

## Parallel Example: User Story 5

```text
Task: "Expand failing retention tests in apps/backend/tests/unit/audit.retention.test.ts"
Task: "Write failing scheduler tests in apps/backend/tests/unit/audit.scheduler.test.ts"
Task: "Write failing integration tests in apps/backend/tests/integration/audit.retention.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (schema and shared helpers block all stories).
3. Complete Phase 3: User Story 1.
4. STOP and VALIDATE: reopen/edit/save/reload/send a draft and confirm immutability after send.
5. Demo the resumed-draft workflow before starting the second P1 story.

### Incremental Delivery

1. Setup + Foundational -> foundation ready.
2. US1 -> validate and demo (MVP).
3. US2 -> validate failure notification/acknowledgement, then demo.
4. US3 -> validate history/filtering/paging, then demo.
5. US4 -> validate resident privacy/history, then demo.
6. US5 -> validate retention boundaries and operator run records.
7. Polish -> performance, docs, full regression gates.

Each story adds value without breaking previous stories; SC-008 requires the existing broadcast,
consent, targeting, reporting, RBAC, and audit suites to keep passing.

## Notes

- [P] means different files and no dependency on an incomplete task.
- Tests MUST fail before implementation; this is a constitution gate, not optional guidance.
- All new query/body inputs must be server-validated with user-friendly 400 errors.
- Page size is bounded to 1-100 with defaults of page 1 and size 20.
- Draft content is non-empty and at most 480 characters; targets must specify a barangay or role;
  LOW_LEVEL jurisdiction rules remain unchanged.
- Notification identity is one `(adminId, alertId)` row; delivery retries that succeed must not
  create a notification.
- Resident history always uses the JWT identity and only that resident's delivery records.
- Retention keeps the strict `createdAt < now - 365 days` comparison so exactly-365-day entries
  survive.
- Commit after each task or logical group and keep the default branch releasable.
