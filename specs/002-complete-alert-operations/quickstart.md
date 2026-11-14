# Quickstart Validation Guide: Alert Operations Completion

**Feature**: `002-complete-alert-operations` | **Date**: 2026-11-13

A runnable guide to prove the feature works end-to-end. It contains setup steps and validation
scenarios, not implementation code or migrations. Interface details live in the
[OpenAPI delta contract](./contracts/openapi.yaml) and data rules in
[data-model.md](./data-model.md); unchanged endpoints are governed by the feature 001 contract.

## Prerequisites

- Node.js 20 LTS or newer and npm
- PostgreSQL 15+ (the repository's one-command dev workflow starts an embedded PostgreSQL 18
  instance on port 5433, so a separate installation is optional)
- Optional: a Google OAuth client for resident sign-in
- No Twilio credentials are required; the mock messaging provider is the default

## Environment variables

Backend (`apps/backend/.env`) adds these optional settings to the existing feature 001 variables:

- `AUDIT_RETENTION_INTERVAL_MS` - cleanup interval, default `86400000` (24 hours); values below
  `60000` are rejected
- `AUDIT_RETENTION_STARTUP_DELAY_MS` - delay before the first startup cleanup, default `5000`
- `MESSAGING_MOCK_FAILURES` - number of mock sends that fail before succeeding; useful for manually
  exercising failure notifications

Existing variables remain: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `GOOGLE_CLIENT_ID`,
`MESSAGING_PROVIDER`, Twilio credentials, `CORS_ORIGIN`, `PORT`, and the messaging retry settings.
Never commit `.env` files or secrets.

## Setup

Recommended one-command workflow from the repository root:

```bash
npm run setup
npm run dev
```

`npm run dev` starts embedded PostgreSQL on port 5433, applies migrations, seeds demo data, and
starts the API (`http://localhost:4000`) and SPA (`http://localhost:5173`).

Manual setup (if using an external database):

```bash
# Backend
cd apps/backend
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev

# Frontend (second terminal)
cd apps/frontend
npm install
npm run dev
```

Seeded administrators: `superadmin@example.com`, `mayor@example.com`, `captain@example.com`,
password `Password123!`. Seeded residents use `resident1@example.com` through
`resident3@example.com` with Google identity subjects `demo-1` through `demo-3`. Resident sign-in is
Google-only; without a Google client, validate resident behavior through the automated API tests or
a locally mocked Google verification.

## Tests

Backend:

```bash
cd apps/backend
npm run lint
npm run typecheck
npm test
npm run test:coverage
```

Frontend:

```bash
cd apps/frontend
npm run lint
npm run typecheck
npm test
```

The backend tests use the mock messaging provider and a dedicated test database. Targeted suites:

```bash
npm --prefix apps/backend test -- tests/unit/audit.retention.test.ts
npm --prefix apps/backend test -- tests/integration/alerts.broadcast.test.ts
npm --prefix apps/backend test -- tests/contract/alerts.contract.test.ts
npm --prefix apps/backend test -- tests/contract/residents.contract.test.ts
npm --prefix apps/frontend test -- tests/components
```

## Manual API checks

Use the version-controlled `requests.http` with the VS Code REST Client, or the Swagger/OpenAPI
viewer of `contracts/openapi.yaml`. Obtain an administrator token with
`POST /api/auth/admin/login` and set it as a bearer token.

## Validation scenarios

Each scenario maps to a prioritized user story and ends with a checkable outcome.

### V1 - Reopen, edit, and send a draft (US1, P1)

1. Sign in to the admin console as `mayor@example.com`.
2. Compose an alert, choose a category and at least one target, and save the draft.
3. Navigate away (for example, open Report Triage), then open Alert History and filter by `DRAFT`.
4. Open the draft, change the message, category, and targets, and save.
5. Reload the page and reopen the draft.

**Expected**: every changed field is shown exactly as last saved. Preview recipients reflects the
saved values. Sending uses those values. After sending, the edit controls disappear and a direct
`PATCH /api/admin/alerts/{alertId}` returns 409 `INVALID_STATE` with the alert unchanged.

**Concurrency check**: open the same draft in two tabs, save in tab A, then save in tab B. The last
successful save wins; reloading shows the winning values. If the draft is sent before a save, the
save returns 409.

### V2 - Failure notifications and acknowledgement (US2, P1)

1. Set `MESSAGING_MOCK_FAILURES=3` (enough to exhaust the three retries for the first phone) and
   restart the backend so the mock provider is recreated.
2. Sign in as a HIGH_LEVEL or SUPERADMIN administrator and broadcast an alert to at least two
   eligible residents.
3. Wait for the broadcast to complete, then inspect the admin header notification bell.
4. Open the notification, follow it to the alert's delivery results, and acknowledge it.
5. Reload the page and open the notification history.

**Expected**: exactly one notification appears, naming the alert, category, failed-delivery count,
and completion time; it survives reload and is removed from the unread count after acknowledgement
but remains in history. A failure that later succeeds after retry creates no notification. A
LOW_LEVEL administrator outside the alert's barangay sees no notification. Reprocessing the alert
does not create a duplicate.

**Automated coverage**: `tests/integration/alerts.broadcast.test.ts` and the notification contract
tests exercise success-only, retry-success, permanent-failure, duplicate-processing, and
jurisdiction cases.

### V3 - Administrator alert history, filtering, and paging (US3, P2)

1. Create or seed more than 20 alerts with a mix of statuses, categories, and barangays.
2. Open Alert History. Confirm newest-first order and that each row shows message summary, category,
   status, targets, creation time, send time when available, and failure count.
3. Apply status, category, barangay, and date-range filters, then add a message search term.
4. Move to the next page, then change a filter and move back.
5. Request a page beyond the end, for example `?page=999`.

**Expected**: every result matches all filters; the total count is shown; filters persist across
paging; no alert is duplicated or skipped across at least 10 pages; a beyond-end request returns the
last valid page with `pageAdjusted: true`; a no-match combination shows an empty state and a reset
control. A LOW_LEVEL administrator sees only alerts in their jurisdiction, and
`availableBarangays` contains only their barangay.

### V4 - Resident personal history (US4, P2)

1. Sign in as a seeded resident through Google (or use a resident token in API-only validation).
2. Open personal alert history.
3. Compare two residents who received the same alert with different delivery outcomes.
4. While a broadcast is still in progress, refresh the history.

**Expected**: each resident sees only alerts with their own delivery records, newest first, with
category, message, send time, and outcome. Outcomes are `SUCCESS`, `FAILURE`, `PARTIAL`, or
`PENDING`; a pending entry later shows the final result after retry. A second resident's token
cannot read the first resident's history because the endpoint accepts no resident identifier.
An empty account shows a clear empty state.

### V5 - Automatic audit retention (US5, P3)

1. Run the retention unit and integration suites:
   `npm --prefix apps/backend test -- tests/unit/audit.retention.test.ts`.
2. Inspect the resulting `AuditRetentionRun` rows through Prisma Studio
   (`npx prisma studio` in `apps/backend`) or a database query.

**Expected**: the run is `SUCCESS` with the number of removed entries and a finish time. Entries
older than 365 days are deleted; entries exactly 365 days old or newer are retained. Running the
cleanup twice removes nothing the second time. An induced failure records a `FAILED` run with an
error summary, does not crash the API, and the next run still removes expired entries. With the
default configuration, the scheduler runs once after startup and every 24 hours without an
administrative action; a temporary `AUDIT_RETENTION_INTERVAL_MS=60000` makes the periodic run easy
to observe in development.

### V6 - Regression check (SC-008)

Run the complete backend and frontend suites listed above. Existing broadcast, consent, targeting,
report submission, report triage, RBAC, and audit tests must all pass with no changes to their
expected behavior.
