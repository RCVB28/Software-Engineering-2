# Localized Emergency Alert & Reporting Platform

A two-sided, single-locality emergency alert and reporting platform: a subscriber portal and an
administrator dashboard, backed by a REST API and SMS delivery (Twilio, with a mock provider for
demos).

## Structure

```text
apps/
  backend/    # Node.js + Express + TypeScript REST API, Prisma, Jest/Supertest
  frontend/   # React + TypeScript + Vite + Tailwind SPA
scripts/
  dev.mjs     # one-command dev orchestrator (database + API + web)
specs/001-emergency-alert-platform/   # Alert platform spec, plan, data model, contracts, tasks
specs/002-complete-alert-operations/  # Feature 002 spec, plan, contracts, tasks, validation
requests.http                          # Local API requests (VS Code REST Client)
.github/workflows/ci.yml               # CI: lint, typecheck, test, coverage, audit
```

All application source lives under `apps/`; the repository root holds repo-level config/docs/scripts.

## Quick start (one command)

Requirements: Node.js 20+ and npm. No Docker or PostgreSQL installation is needed for development.

```bash
npm run setup   # installs root, backend, and frontend dependencies
npm run dev
```

`npm run dev` starts everything:

- an embedded PostgreSQL instance in `.devdb/` on port `5433`;
- migrations and seed data (idempotent on later runs);
- the API on http://localhost:4000;
- the SPA on http://localhost:5173.

Press `Ctrl+C` once to stop the API, web app, and database together.

Demo administrator logins (password `Password123!`):

- `superadmin@example.com`
- `mayor@example.com`
- `captain@example.com`

Resident sign-in uses Google. To enable it, set `GOOGLE_CLIENT_ID` in `apps/backend/.env` and
`VITE_GOOGLE_CLIENT_ID` in `apps/frontend/.env` (same Web OAuth client, origin
`http://localhost:5173`). Without it, admin features still work.

Optional overrides: `DEV_DB_PORT` (default `5433`) and `DEV_DB_NAME` (default `se2`).

## Manual setup

See `specs/001-emergency-alert-platform/quickstart.md` for full prerequisites and validation
scenarios. If you prefer your own PostgreSQL instance:

```bash
cd apps/backend
npm install
cp .env.example .env            # set DATABASE_URL and JWT_SECRET
npx prisma migrate deploy
npm run prisma:seed
npm run dev                     # API on :4000

cd apps/frontend
npm install
cp .env.example .env
npm run dev                     # SPA
```

## Tests

```bash
cd apps/backend && npm run lint && npm run typecheck && npm test
cd apps/frontend && npm run lint && npm run typecheck && npm test
```

Database-backed tests require `RUN_DB_TESTS=1` and a reachable PostgreSQL database; see
`specs/001-emergency-alert-platform/validation.md`. The messaging provider defaults to `mock` so no
paid SMS is sent.

## Alert operations (feature 002)

Feature 002 adds draft editing, failure notifications, administrative and resident alert history,
and automatic audit retention. See `specs/002-complete-alert-operations/quickstart.md` for scenarios
V1-V6 and `specs/002-complete-alert-operations/validation.md` for the recorded gate results.

Audit retention runs automatically in the API process: a startup cleanup after
`AUDIT_RETENTION_STARTUP_DELAY_MS` and then every `AUDIT_RETENTION_INTERVAL_MS`. Each run is recorded
in `AuditRetentionRun`, entries older than exactly 365 days are removed, and failures are logged and
persisted without stopping the scheduler.
