# Backend API

Node.js + Express + TypeScript REST API with Prisma/PostgreSQL, JWT authentication, Google ID-token
verification for residents, and SMS delivery through Twilio or the built-in mock provider.

## Setup

```bash
npm install
cp .env.example .env
npx prisma migrate deploy    # or: npx prisma db push
npm run prisma:seed
npm run dev
```

The API listens on `http://localhost:4000` and exposes `GET /health` and `GET /api/health`.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Signing secret for access tokens |
| `JWT_EXPIRES_IN` | Token lifetime (default `1h`) |
| `GOOGLE_CLIENT_ID` | Google OAuth client used to verify resident ID tokens |
| `MESSAGING_PROVIDER` | `mock` (default) or `twilio` |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | Twilio credentials |
| `CORS_ORIGIN` | Comma-separated allowlist (default `http://localhost:5173`) |
| `MESSAGING_MAX_RETRIES` / `MESSAGING_RETRY_DELAY_MS` | Dispatch retry policy |
| `AUDIT_RETENTION_INTERVAL_MS` | Scheduled audit cleanup interval (default `86400000`; minimum `60000`) |
| `AUDIT_RETENTION_STARTUP_DELAY_MS` | Delay before the first startup cleanup (default `5000`) |

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Watch mode via tsx |
| `npm run build` / `npm start` | Compile to `dist/` and run |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Jest + Supertest |
| `npm run test:coverage` | Jest with coverage thresholds |
| `npm run prisma:generate` / `npm run prisma:migrate` / `npm run prisma:seed` | Prisma tooling |

## Tests

Unit tests (validation, dispatch retry/idempotency, tokens, recipient resolution) run without a
database. Contract and integration tests need PostgreSQL and are gated behind `RUN_DB_TESTS=1`:

```bash
$env:RUN_DB_TESTS = '1'; npm test
```

The mock provider never sends real SMS. Delivery records use the deterministic idempotency key
`alertId:residentId:phone` so retries cannot duplicate messages.

## Failure notifications

When a broadcast reaches `COMPLETED`, the dispatch flow counts terminal `FAILURE` deliveries and
creates one persisted notification per authorized administrator. `SUPERADMIN` and `HIGH_LEVEL`
admins see every failed broadcast; `LOW_LEVEL` admins see only broadcasts they created or that
targeted their barangay. Notifications use a unique `(adminId, alertId)` pair, so repeated
processing refreshes the failure count instead of creating duplicates. Administrators can list,
page, filter to unread, and acknowledge notifications through `/api/admin/notifications`.

## Audit retention scheduler

The API starts a retention scheduler after it begins listening. The first run happens after
`AUDIT_RETENTION_STARTUP_DELAY_MS`; subsequent runs occur every `AUDIT_RETENTION_INTERVAL_MS`. Each
run creates an `AuditRetentionRun` row in `RUNNING`, deletes entries whose `createdAt` is strictly
older than 365 days, and records `SUCCESS` with the removed count or `FAILED` with an error summary.
Failures are logged, never rethrown, and an in-process overlap guard prevents concurrent runs.
Scheduler timers are `unref`'d and cleared during shutdown.

## Domain rules

- Three administrator tiers: `SUPERADMIN`, `HIGH_LEVEL` (city-wide), `LOW_LEVEL` (own barangay).
- Residents must have granted consent, at least one phone number, and a matching category preference
  to be eligible for a broadcast.
- Report lifecycle: `NEW → ACKNOWLEDGED → RESOLVED | DISMISSED` and `NEW → DISMISSED`.
- Escalation by a `HIGH_LEVEL` admin creates a `DRAFT` alert that still requires confirmation.
- Audit entries are written for logins, broadcasts, report transitions, escalations, and account
  changes; automatic retention removes entries older than 365 days and records every run.
