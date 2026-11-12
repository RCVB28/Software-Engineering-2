# Validation Report — 2026-11-12

Environment: Windows, Node.js 24.13.0, npm 11.15.0. A temporary embedded PostgreSQL 18.6 cluster
(port 55432) was used to execute the database-backed suite locally; CI uses the `postgres:15`
service from `.github/workflows/ci.yml`.

## Automated gates

| Gate | Scope | Result |
| --- | --- | --- |
| Typecheck | `apps/backend` (`tsc --noEmit`) | PASS |
| Lint | `apps/backend` (ESLint) | PASS (0 errors, 0 warnings) |
| Migration | `prisma migrate deploy` on an empty UTF-8 database | PASS — 1 migration applied, status up to date |
| Seed | `prisma db seed` on the migrated database | PASS — 3 barangays, 3 admins, 3 residents |
| Full test suite | `apps/backend` with `RUN_DB_TESTS=1` | PASS — 17 suites, 73 tests |
| Coverage | `apps/backend` `test:coverage` | PASS — statements 86.75%, branches 61.19%, functions 87.02%, lines 89.03% (thresholds 40/30/40/40) |
| Liveness | `GET /health` on a live server | PASS — `{"status":"ok"}` |
| Typecheck | `apps/frontend` (`tsc --noEmit`) | PASS |
| Lint | `apps/frontend` (ESLint) | PASS |
| Component tests | `apps/frontend` (`npm test`) | PASS — 5 tests |
| Production build | `apps/frontend` (`npm run build`) | PASS — ~217 kB JS |
| Dependency audit (production deps, high) | backend + frontend | PASS — no high/critical; moderate `uuid` and `react-router` advisories remain |

Database-backed test command:

```powershell
cd apps/backend
$env:DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/se2_test?schema=public'
$env:JWT_SECRET = 'local-test-secret'
$env:MESSAGING_PROVIDER = 'mock'
$env:RUN_DB_TESTS = '1'
npx prisma db push --skip-generate
npm run test:coverage
```

The suite resets all tables between tests, uses `MockProvider`, and needs no network services.

## Quickstart scenarios (V1–V6)

| Scenario | Status | Evidence |
| --- | --- | --- |
| V1 — Admin signs in and broadcasts a targeted alert | PASS (API level) | Live server smoke: login as `mayor@example.com` → created `DRAFT` alert → preview count 1 → confirm returned `COMPLETED` → 1 `SUCCESS` delivery with idempotency key → audit log had 6 entries |
| V2 — Consent, opt-out, and phone eligibility | PASS (automated) | `tests/integration/alerts.broadcast.test.ts` verifies consent revocation, per-category opt-out, and cross-barangay exclusion |
| V3 — Resident registration and preferences | PASS (API level, automated) | `tests/contract/residents.contract.test.ts` and `tests/integration/residents.portal.test.ts` cover registration, profile, consent, phones, and preferences. Real Google ID-token exchange was not exercised (no Google credentials) |
| V4 — Report submission and triage | PASS (automated) | `tests/contract/reports.contract.test.ts` and `tests/integration/reports.triage.test.ts` cover submit, acknowledge, resolve/dismiss, and cross-barangay denial |
| V5 — Escalation | PASS (automated) | `tests/integration/reports.triage.test.ts` verifies HIGH_LEVEL escalation creates a `DRAFT` alert requiring confirmation |
| V6 — Administration and audit | PASS (automated) | `tests/contract/admins.contract.test.ts` and `tests/integration/admins.rbac.test.ts` cover admin CRUD, role/barangay rules, deactivation, and filtered audit reads |

## Defects found and fixed during validation

1. `prisma/migrations/20261112000000_init/migration.sql` was written with a UTF-8 BOM, causing
   `ERROR: syntax error at or near "﻿"` on `prisma migrate deploy`. The BOM was removed; the
   migration now applies cleanly and `prisma migrate status` reports up to date.
2. `tests/integration/alerts.broadcast.test.ts` expected 2 eligible residents for a `FLOOD` alert
   while one resident had opted out only of `FIRE`. Per the data model, that resident remains
   eligible for `FLOOD`; the expectation was corrected to 3 (the `FIRE` broadcast test still
   verifies that the opt-out excludes them, with 2 deliveries).
3. `apps/backend/package.json` gained an `overrides` entry for `deepmerge-ts@^8` to clear the high
   advisory pulled in by the Prisma CLI config loader; `prisma generate`, `migrate deploy`, and
   `db seed` were re-verified afterwards.

## Remaining manual verification

1. Run the UI flows in a browser (`npm run dev` for API and SPA) for V1, V3, and V4 click paths.
2. Exercise a real Google sign-in (`VITE_GOOGLE_CLIENT_ID` + backend `GOOGLE_CLIENT_ID`) and, if
   desired, a Twilio test credential (`MESSAGING_PROVIDER=twilio`).
3. Confirm the GitHub Actions workflow is green after the first push; the local run reproduced
   every CI step except the hosted PostgreSQL service and the Actions runner itself.
