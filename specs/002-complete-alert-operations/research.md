# Phase 0 Research: Alert Operations Completion

**Feature**: `002-complete-alert-operations` | **Date**: 2026-11-13

The feature extends the existing feature 001 stack; all Technical Context items are known. This
document records the design decisions that resolve the open implementation choices, their
rationale, and the alternatives rejected.

## 1. Draft editing and concurrency

- **Decision**: Reuse the existing `PATCH /api/admin/alerts/{alertId}` and `updateDraft` logic.
  Extract the composer form into a shared `AlertForm` component and add an edit mode to the alert
  detail page. Draft saves update conditionally on `status = DRAFT`; concurrent saves both remain
  eligible and the last successful save wins. Confirmation claims the alert inside a transaction
  with `updateMany({ where: { id, status: DRAFT } })`, then re-reads the alert and target rows before
  resolving recipients. A save after confirmation fails with 409; a competing send fails with 409.
- **Rationale**: The backend already persists and validates content, category, and targets. The
  missing pieces are the editing UI and a guard against writing after the draft left the editable
  state. Claiming the state first and re-reading inside the transaction guarantees the broadcast
  uses the latest committed values while preserving the spec's "last successful save wins" rule.
- **Alternatives considered**: An optimistic `updatedAt` token on saves (rejected - would reject a
  legitimate concurrent save, contradicting last-save-wins); a `version` integer column (rejected -
  extra schema and client coordination for little benefit at this scale); database row locks
  through raw SQL (rejected - the conditional claim already serializes the state transition);
  allowing last-write-wins without any state guard (rejected - an edit could land after a send).

## 2. Failure notification persistence and fan-out

- **Decision**: Add a `FailureNotification` table keyed uniquely by `(adminId, alertId)`. After
  `dispatchAlert` marks the alert `COMPLETED`, count terminal `FAILURE` delivery records. If the
  count is greater than zero, resolve the eligible active administrators with the same jurisdiction
  predicate used for reading the alert and upsert one notification per administrator. The upsert
  refreshes the failure count and completion time but never creates a second row.
- **Rationale**: Persistence is required so notifications survive reloads and so acknowledgement
  state can be tracked. A unique key makes repeated processing and interrupted-retry reprocessing
  idempotent. Reusing the read-scope predicate guarantees low-level administrators never receive
  notifications for other barangays.
- **Alternatives considered**: In-memory notifications (rejected - lost on restart, no durable
  acknowledgement); deriving notifications from delivery records plus per-admin read markers
  (rejected - more joins and state, no simpler); one row per delivery failure (rejected - the spec
  requires one notification per alert per administrator); email/SMS fan-out (explicitly out of
  scope).

## 3. Notification refresh in the SPA

- **Decision**: Fetch the unread count and notification list when the admin layout mounts, when the
  notification panel opens, after an acknowledgement, and on a 30-second interval while an admin
  session is active. No WebSocket or server-sent events are added.
- **Rationale**: The acceptance criteria require notifications to appear after broadcast and to
  survive reload, not sub-second push. Polling is simple, restart-safe, and consistent with the
  existing REST client. A 30-second interval keeps the database load negligible at the target scale.
- **Alternatives considered**: WebSockets/SSE (rejected - new transport, connection lifecycle, and
  deployment concerns for no stated requirement); fetch only on page navigation (rejected -
  administrators could miss a failure for a long time while working in one screen).

## 4. Administrator alert history query

- **Decision**: Add `GET /api/admin/alerts/history` with `page`, `pageSize`, `status`, `category`,
  `barangayId`, `from`, `to`, and `q` parameters. Build one `Prisma.AlertWhereInput` by composing
  the jurisdiction scope with ANDed filters; include targets and a filtered `_count` of `FAILURE`
  deliveries. Return `{ items, page, pageSize, total, totalPages, pageAdjusted,
  availableBarangays }`.
- **Rationale**: A separate endpoint avoids breaking the existing recent-list response consumed by
  the composer. Filtering and counting in PostgreSQL keeps memory bounded and satisfies the 10,000-
  alert performance target with indexes on `Alert.createdAt`, `Alert.status`, `Alert.category`, and
  `DeliveryRecord(alertId, status)`. Offset pagination supports direct page jumps and total counts.
- **Alternatives considered**: Extending the existing endpoint and changing its response shape
  (rejected - breaking change for 001); cursor pagination (rejected - no total/page numbers, more
  complex UI for a modest dataset); client-side filtering (rejected - unbounded payload and does
  not scale); full-text search (rejected - case-insensitive `contains` is sufficient and needs no
  index/extension).
- **Stable order**: `createdAt DESC, id DESC` is used for both the page query and the total count.
  The `id` tiebreaker prevents skipped or repeated rows when alerts share a timestamp.
- **Beyond-last-page behavior**: The service computes `totalPages` first, clamps the requested page
  to the last valid page when results exist, and returns `pageAdjusted: true`. This implements the
  spec edge case without an error.
- **Barangay filter semantics**: An alert matches barangay X when any target names X or targets all
  barangays (`barangayId: null`). Low-level administrators may only request their own barangay;
  `availableBarangays` contains only that barangay for them.

## 5. Resident personal alert history

- **Decision**: Add `GET /api/residents/me/alert-history`, scoped to the authenticated resident.
  Query alerts that have at least one delivery record for that resident, include only that
  resident's deliveries, and return one entry per alert with an aggregate outcome. Paginate with
  the same offset strategy and `createdAt DESC, id DESC` order.
- **Rationale**: Delivery records are the authoritative evidence that an alert was directed to the
  resident and preserve history after a resident changes barangay. Deriving the resident from the
  JWT makes cross-resident access impossible because the endpoint accepts no resident identifier.
  Aggregating multiple phones gives one readable entry while still reflecting the final result.
- **Outcome mapping**: Any `SUBMITTED` or `DELAYED` delivery => `PENDING`; all `SUCCESS` =>
  `SUCCESS`; all `FAILURE` => `FAILURE`; a mix of `SUCCESS` and `FAILURE` => `PARTIAL`.
- **Alternatives considered**: Recomputing eligibility from current target/consent data (rejected -
  would hide historical alerts after a profile change and is not proof of delivery); one row per
  phone (rejected - spec describes one entry per alert and the UI is simpler); returning raw
  delivery records (rejected - exposes unnecessary detail and couples the UI to delivery internals).

## 6. Input validation and error behavior

- **Decision**: Extend the existing hand-written validation helpers with query parsers for positive
  integers, bounded page sizes, ISO instants, optional enum values, and trimmed search text. Return
  the existing structured `{ message, code, details }` error shape with 400 for invalid input, 403
  for jurisdiction violations, 404 for unknown resources, and 409 for state conflicts.
- **Rationale**: Reuses the project's established error contract and avoids a new validation
  dependency. Explicit parsing keeps the query object free of unvalidated strings before it reaches
  Prisma.
- **Alternatives considered**: Adding Zod/express-validator (rejected for this feature - existing
  helpers are sufficient); trusting Express query strings (rejected - type confusion, unbounded page
  sizes, and malformed dates).

## 7. Audit retention scheduling

- **Decision**: Keep `purgeAuditEntries` as a pure function with the strict `createdAt < cutoff`
  comparison. Add `runAuditRetention` that creates an `AuditRetentionRun` row in `RUNNING`, performs
  the purge, then updates the row to `SUCCESS` with `removedCount`; on error it updates to `FAILED`
  with the error message and swallows the exception. Add `startAuditRetentionScheduler` to run once
  shortly after server startup and then every 24 hours, guarded by an in-process `running` flag and
  an `unref`'d timer.
- **Rationale**: An entry exactly 365 days old must be retained, which `< cutoff` guarantees. A
  persisted run row satisfies the operator-visibility requirement and makes tests observable.
  Running off the request path and swallowing scheduler errors prevents user-facing outages. The
  running flag avoids overlapping runs in a single process.
- **Alternatives considered**: A cron job or OS scheduler (rejected - adds deployment configuration
  and is not available in the one-command dev workflow); `pg_cron` (rejected - extension
  installation and portability); only logging to stdout (rejected - not durable or queryable for
  operators); running on every request (rejected - unpredictable latency and load).
- **Multi-instance limitation**: The in-process guard is not a distributed lock. The feature's
  deployment assumption is one API instance; if that changes, a database advisory lock must be
  added. This is documented rather than built now (YAGNI).
- **Clock and interval**: Retention uses UTC millisecond arithmetic (365 * 24 * 60 * 60 * 1000), so
  daylight-saving transitions do not affect the cutoff. A startup run makes the policy effective
  immediately after a restart; repeated runs are harmless.

## 8. Date and time display

- **Decision**: The API accepts and returns UTC ISO 8601 instants. The browser converts history
  filter day boundaries to instants before calling the API and renders timestamps with the existing
  local formatting helper. No locality timezone field is added.
- **Rationale**: The app is single-locality and the browser already displays local time. Converting
  at the client boundary keeps server queries unambiguous and avoids speculative schema changes.
- **Alternatives considered**: Adding `Locality.timezone` and doing conversion server-side (rejected
  for this feature - no multi-locality requirement; can be added when multi-locality is addressed);
  accepting date-only strings and assuming a server timezone (rejected - ambiguous and fragile).

## 9. Testing strategy

- **Decision**:
  - Unit tests: filter/paging parsing, stable where-builder composition, resident outcome
    aggregation, notification audience predicate, retention boundary (exactly 365 days), scheduler
    overlap guard, and persisted run success/failure.
  - Contract tests: history filters/paging/validation, notification list/acknowledge, resident
    history privacy, and draft edit state conflicts.
  - Integration tests: failure fan-out after dispatch (including retry-success produces none and
    repeated processing creates no duplicate), low-level jurisdiction exclusion, page stability
    across 10 pages, and cross-resident denial.
  - Frontend tests: shared `AlertForm` create/edit/submit behavior, history filter preservation
    across pages, notification unread count after acknowledgement, and empty states.
  - All delivery tests use the mock provider; time-dependent tests use Jest fake timers and inject
    a fixed clock where needed. No live network calls.
- **Rationale**: Matches the constitution's unit/integration split and directly maps tests to the
  measurable success criteria (SC-002, SC-005, SC-006, SC-007, SC-008).
- **Alternatives considered**: Browser end-to-end tests (out of scope per the spec); relying only on
  manual checks (rejected - TDD is non-negotiable).

## 10. No new dependencies

- **Decision**: Implement all changes with the current stack. PostgreSQL/Prisma provides filtered
  relation counts and indexes; the scheduler uses Node's built-in timers; the SPA uses the existing
  fetch client and React state.
- **Rationale**: The required behavior is achievable within the approved stack, and the
  constitution requires justification for new dependencies. Avoiding them also keeps CI and the
  dependency audit unchanged.
- **Alternatives considered**: A notification library, a job queue, or a date library (all rejected
  as unnecessary for the scope).

## Resolved clarifications

- No `[NEEDS CLARIFICATION]` items remain. The spec's assumptions cover notification channel,
  terminal-failure semantics, retention period, last-save-wins concurrency, daily scheduling,
  timezone display, page-size bounds, resident visibility, and unchanged alert rules.
