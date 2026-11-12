# Quickstart Validation Guide

**Feature**: `001-emergency-alert-platform` | **Date**: 2026-11-12

A runnable guide to prove the feature works end-to-end. This is a validation/run guide — it does not
contain implementation code, migrations, or full test suites. Interface details live in
[`contracts/openapi.yaml`](./contracts/openapi.yaml) and data rules in
[`data-model.md`](./data-model.md).

## Prerequisites

- Node.js 20 LTS and npm
- PostgreSQL 15+ running locally (or a managed instance)
- A Google OAuth client (for resident sign-in); optional for API-only validation if using seeded
  resident sessions
- Optional: Twilio test credentials (only to validate real provider connectivity)
- Git

## Environment variables

Backend (`apps/backend/.env`):

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET`, `JWT_EXPIRES_IN` — token signing
- `GOOGLE_CLIENT_ID` — resident Google OAuth
- `MESSAGING_PROVIDER` — `mock` (default) or `twilio`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` — only when `MESSAGING_PROVIDER=twilio`
- `PORT` — API port (default `4000`)

Frontend (`apps/frontend/.env`):

- `VITE_API_BASE_URL` — e.g. `http://localhost:4000`

Never commit `.env` files or secrets.

## Setup

```bash
# Backend
cd apps/backend
npm install
npx prisma migrate dev          # apply schema
npx prisma db seed              # barangays, demo admins, demo residents
npm run dev                     # starts API on :4000

# Frontend (second terminal)
cd apps/frontend
npm install
npm run dev                     # starts the SPA
```

For a hermetic test database, point `DATABASE_URL` at a separate test database and reset it before
running tests.

## Tests

```bash
cd apps/backend
npm run lint
npm run typecheck
npm test                        # Jest unit + Supertest integration (mock messaging provider)
npm run test:coverage           # enforce coverage threshold
```

Frontend:

```bash
cd apps/frontend
npm run lint
npm run typecheck
npm test
```

CI (GitHub Actions) runs the same lint, typecheck, test, coverage, and dependency-audit steps and
blocks merges on failure.

## Manual API checks

Use the version-controlled `requests.http` with the VS Code REST Client. Obtain a token via
`POST /api/auth/admin/login` and set it as a bearer token variable.

## Validation scenarios

Each scenario maps to a prioritized user story and ends with a checkable outcome.

### V1 — Targeted broadcast (US1, P1)

1. Sign in as a HIGH_LEVEL administrator.
2. Create a draft alert with content and category; target Barangay A plus role `RESIDENT`.
3. `GET /api/admin/alerts/{id}/recipients` and confirm the preview contains only active, consented
   residents of Barangay A with role `RESIDENT`, and excludes anyone opted out of that category.
4. `POST /api/admin/alerts/{id}/confirm`.
5. `GET /api/admin/alerts/{id}/deliveries`.

**Expected**: alerts with no eligible recipients are rejected; after confirmation every intended
recipient has a delivery record; with the mock provider all are reachable statuses; no message is
sent for an unconfirmed draft.

### V2 — Duplicate prevention on retry (US1)

1. Configure the mock provider to fail once, then succeed.
2. Broadcast an alert.
3. Inspect delivery records and provider mock send log.

**Expected**: the failed attempt is retried, the recipient receives exactly one successful message,
and the delivery record shows the final `SUCCESS` with `attempts` > 1.

### V3 — Subscriber registration and preferences (US2, P2)

1. Sign in as a new resident via Google (or a seeded resident token in API-only mode).
2. Update profile with a barangay, optional building tag, and role; grant consent.
3. Add a second phone number and set a category preference to opted out.
4. Broadcast an alert in that category to the resident's barangay.
5. View announcements and history.

**Expected**: profile persists; without consent the resident is never targeted; opted-out category is
excluded but other categories still deliver; new phone number appears in delivery when eligible.

### V4 — Report submission and triage (US3, P2)

1. As a resident, submit a report with category, severity, description (≤500 chars), and location.
2. As a LOW_LEVEL admin of the same barangay, list reports and set status to ACKNOWLEDGED, then
   RESOLVED.
3. As a LOW_LEVEL admin of a different barangay, attempt to fetch the report.
4. As a HIGH_LEVEL admin, escalate a report.

**Expected**: report starts `NEW`; status transitions succeed in order; cross-barangay access returns
`403`; escalation creates a `DRAFT` alert that still requires confirmation; descriptions over 500
characters are rejected with `400`.

### V5 — Role administration and audit (US4, P3)

1. As SUPERADMIN, create an administrator with each role.
2. Attempt to create an administrator as HIGH_LEVEL.
3. Perform a role change and a broadcast.
4. As SUPERADMIN, read the audit trail.

**Expected**: only SUPERADMIN can manage accounts (`403` otherwise); role/barangay constraints hold
(LOW_LEVEL requires a barangay); the role change and broadcast appear as audit entries; entries
older than one year are eligible for cleanup.

### V6 — Performance smoke (all)

1. Seed 1,000 residents.
2. Confirm an alert to a large target and measure confirmation-to-submission time.
3. Load the portal and dashboard.

**Expected**: submission within 5 seconds of confirmation; expected delivery within 15 seconds under
normal conditions (reported, not guaranteed, during provider outages); main content loads within
3 seconds; admin read/write within 50 ms in local conditions.

## Out-of-scope checks (should NOT be possible)

- Multi-locality data or targeting.
- Paid live SMS as a required demo step.
- OTP phone verification.
- Direct database access from the administrator dashboard.
- Sending an alert without explicit confirmation.
