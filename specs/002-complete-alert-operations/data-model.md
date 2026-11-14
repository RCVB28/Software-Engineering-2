# Data Model: Alert Operations Completion

**Feature**: `002-complete-alert-operations` | **Date**: 2026-11-13

This document describes the logical model changes for feature 002. The existing feature 001 model
remains authoritative for unchanged entities; see
[`../001-emergency-alert-platform/data-model.md`](../001-emergency-alert-platform/data-model.md).
Storage is PostgreSQL accessed through Prisma. All timestamps are UTC. Identifiers are UUIDs unless
noted.

## New enumerations

### RetentionRunStatus

- `RUNNING` - the cleanup is in progress.
- `SUCCESS` - the cleanup finished and the removed count is recorded.
- `FAILED` - the cleanup raised an error; the reason is recorded and the next run retries.

## New entities

### FailureNotification

An administrator-specific, in-app notice that an alert completed with at least one terminal
delivery failure.

- **id**: UUID, primary key
- **adminId**: FK -> Administrator, required
- **alertId**: FK -> Alert, required
- **failureCount**: integer, required, greater than zero (snapshot at fan-out; refreshed on
  reprocessing)
- **completedAt**: timestamp, required (when the alert reached `COMPLETED` for this fan-out)
- **readAt**: timestamp, nullable (null = unread)
- **createdAt**, **updatedAt**: timestamps
- Relationships: many FailureNotifications -> one Administrator; many -> one Alert.
- Validation/constraints:
  - `(adminId, alertId)` unique: at most one notification per alert per administrator, regardless
    of retries or repeated processing.
  - `failureCount` counts only `DeliveryRecord.status = FAILURE`; `DELAYED` and retried successes do
    not count.
  - Only administrators authorized to view the alert (same predicate as alert reads) receive rows.
- State: `unread (readAt = null) -> acknowledged (readAt set)`. Acknowledgement is idempotent;
  acknowledged rows remain in notification history and are never deleted by this feature.
- Indexes: `(adminId, readAt)` for unread counts/lists, `(alertId)` for alert detail joins, and
  `(adminId, createdAt)` for paged history.

### AuditRetentionRun

A durable record of one automatic audit-retention attempt, used for operator visibility.

- **id**: UUID, primary key
- **status**: RetentionRunStatus, required, default `RUNNING`
- **startedAt**: timestamp, required, default now
- **finishedAt**: timestamp, nullable
- **removedCount**: integer, required, default `0`
- **error**: string, nullable (failure reason when status is `FAILED`)
- **createdAt**: timestamp, required, default now
- Relationships: none (operational record).
- Validation/constraints:
  - One row per attempt; retries create new rows rather than mutating prior failures.
  - A successful run sets `finishedAt`, `removedCount`, and `SUCCESS` atomically.
  - A failed run sets `finishedAt`, `FAILED`, and a non-secret error summary; the scheduler logs the
    error and continues.
- Index: `(startedAt)` for operator inspection and ordering.

## Changes to existing entities

### Alert

Add the inverse relation `failureNotifications FailureNotification[]`. No new persisted fields are
required. Add query-support indexes:

- `@@index([createdAt])` - history ordering and date-range filters.
- `@@index([status])` - status filter.
- `@@index([category])` - category filter.
- `@@index([createdByAdminId])` - low-level creator scope.

`confirmedAt` remains the send timestamp. `updatedAt` is maintained for display; state transitions
use a conditional `status = DRAFT` claim rather than an optimistic version token, so concurrent
saves preserve last-successful-save-wins semantics.

### Administrator

Add the inverse relation `failureNotifications FailureNotification[]`. No new fields.

### DeliveryRecord

No fields change. Add indexes used by history and notification fan-out:

- `@@index([alertId, status])` - filtered failure counts and terminal-failure detection.
- `@@index([residentId])` - resident personal history.

The existing unique `(alertId, residentId, phoneNumber)` and unique `idempotencyKey` remain.

### AlertTarget

No fields change. Add `@@index([barangayId])` for jurisdiction and barangay filtering.

### AuditEntry

No fields change. The existing `@@index([createdAt])` supports both the audit list and the purge
query. Retention uses `createdAt < now - 365 days`, so an entry exactly 365 days old is retained.

## Derived read models (not tables)

### Administrator alert history entry

Returned by `GET /api/admin/alerts/history`:

- **id**, **content**, **category**, **status**
- **targets**: `{ barangayId: string | null, residentRole: ResidentRole | null }[]`
- **createdAt**, **confirmedAt** (null while DRAFT)
- **failureCount**: count of the alert's `FAILURE` delivery records

Paging envelope: `{ items, page, pageSize, total, totalPages, pageAdjusted, availableBarangays }`.

- `total` is the count matching the same jurisdiction + filters as `items`.
- `totalPages = ceil(total / pageSize)`; zero results yields `0`.
- A request beyond the last page is clamped to the last valid page and `pageAdjusted` is `true`.
- Order is `createdAt DESC, id DESC` to remain stable across pages.
- `availableBarangays` contains only barangays the caller may filter by: the caller's own barangay
  for LOW_LEVEL, all barangays otherwise.

Filter semantics:

| Filter | Rule |
|--------|------|
| `status` | Exact `AlertStatus` match; invalid values rejected with 400. |
| `category` | Exact `AlertCategory` match; invalid values rejected with 400. |
| `barangayId` | MATCH alerts having a target for that barangay OR a target with `barangayId = null`. LOW_LEVEL may only use their own barangay. |
| `from` | `createdAt >= from` (ISO 8601 instant). |
| `to` | `createdAt <= to` (ISO 8601 instant). `from <= to` required. |
| `q` | Case-insensitive substring match on `content`, trimmed, 1-200 characters. |
| Combination | All provided filters are ANDed with the caller's jurisdiction scope. |

### Resident alert history entry

Returned by `GET /api/residents/me/alert-history`:

- **alertId**, **category**, **content**
- **sentAt**: the alert's `confirmedAt` (fallback `createdAt` only if a legacy confirmed alert lacks
  it)
- **outcome**: `SUCCESS | FAILURE | PARTIAL | PENDING`

Outcome aggregation over the requesting resident's own `DeliveryRecord` rows for the alert:

- any `SUBMITTED` or `DELAYED` -> `PENDING`
- otherwise all `SUCCESS` -> `SUCCESS`
- otherwise all `FAILURE` -> `FAILURE`
- otherwise a mix of `SUCCESS` and `FAILURE` -> `PARTIAL`

Paging envelope: `{ items, page, pageSize, total, totalPages, pageAdjusted }`, ordered by
`createdAt DESC, id DESC`, page size default 20, maximum 100. Only alerts with at least one delivery
record for the authenticated resident are included; the resident identity always comes from the
JWT, never from a request parameter.

## Recipient/audience rules

The existing feature 001 recipient eligibility rule is unchanged. Failure-notification audience is
the administrator equivalent of alert read scope:

- `SUPERADMIN` and `HIGH_LEVEL`: all active administrators in the locality.
- `LOW_LEVEL`: only active administrators who created the alert or whose barangay is named by at
  least one alert target.
- Inactive administrators receive no new notifications.
- Deduplication is enforced by the unique `(adminId, alertId)` constraint.

## State transitions

### Alert draft

```text
DRAFT --save (conditional on status = DRAFT)--> DRAFT
DRAFT --confirm (claim status = DRAFT in a transaction)--> CONFIRMED --> SENDING --> COMPLETED
DRAFT --save after confirm--> 409 INVALID_STATE (no change)
CONFIRMED/SENDING/COMPLETED --edit or resend--> 409 INVALID_STATE (no change)
```

- A save races a confirm: the save succeeds only while the status is still DRAFT; if the confirm
  claims first, the save receives 409 and leaves the alert unchanged.
- A confirm races another save: the confirm claims the row, then re-reads content, targets, and
  recipients inside the transaction, so it always broadcasts the latest committed draft.
- A confirm with no eligible recipients rolls the claim back and leaves the alert in DRAFT.
- The last successful save wins among concurrent editors.

### FailureNotification

```text
(no row) --alert completes with >= 1 FAILURE--> UNREAD
UNREAD --acknowledge--> ACKNOWLEDGED
ACKNOWLEDGED --acknowledge--> ACKNOWLEDGED (idempotent)
UNREAD/ACKNOWLEDGED --alert reprocessed with failures--> same row, refreshed failureCount/completedAt
```

### AuditRetentionRun

```text
RUNNING --purge succeeds--> SUCCESS (finishedAt, removedCount)
RUNNING --purge fails--> FAILED (finishedAt, error)
```

A later scheduled run creates a new row; a `FAILED` row is never reused.

## Validation rules (new inputs)

- `page`: integer >= 1, default 1.
- `pageSize`: integer 1-100, default 20.
- `status`, `category`: optional, must be members of the existing enums.
- `barangayId`: optional; must be a barangay the caller may scope to.
- `from`, `to`: optional ISO 8601 instants; invalid dates or `from > to` return 400.
- `q`: optional, trimmed, 1-200 characters; empty is treated as absent.
- Notification acknowledgement: the notification must exist and belong to the authenticated
  administrator; otherwise 404 (no data leak).
- Unknown/extra write fields continue to be rejected per the feature 001 validation rules.
- Draft content remains non-empty and <= 480 characters; targets remain non-empty and must specify
  a barangay or a role; LOW_LEVEL target scope is unchanged.

## Relationships (incremental summary)

- Administrator 1 -> many FailureNotification
- Alert 1 -> many FailureNotification
- Administrator 1 -> many Alert (existing)
- Alert 1 -> many AlertTarget (existing), 1 -> many DeliveryRecord (existing)
- Resident 1 -> many DeliveryRecord (existing); resident history reads only the caller's records
- AuditRetentionRun is standalone operational data
