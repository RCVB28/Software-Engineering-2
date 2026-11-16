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
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | Twilio credentials (required when `MESSAGING_PROVIDER=twilio`) |
| `CORS_ORIGIN` | Comma-separated allowlist (default `http://localhost:5173`) |
| `MESSAGING_MAX_RETRIES` / `MESSAGING_RETRY_DELAY_MS` | Dispatch retry policy |
| `MESSAGING_MOCK_FAILURES` | Simulated failures for the mock provider (default `0`) |

## Verifying SMS / Twilio

Two admin endpoints make the messaging layer testable without composing a broadcast:

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| GET | `/api/admin/messaging/status` | any admin | Active provider and whether the Twilio credentials are complete |
| POST | `/api/admin/messaging/test` | SUPERADMIN | Send one message through the active provider |

With `MESSAGING_PROVIDER=mock` the test endpoint is a free dry run. To exercise the real Twilio API,
set `MESSAGING_PROVIDER=twilio` plus the three `TWILIO_*` values, then:

```bash
curl -X POST http://localhost:4000/api/admin/messaging/test \
  -H "Authorization: Bearer <superadmin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"to":"+639171234567","body":"LEARW test"}'
```

On a Twilio **trial** account only verified destination numbers receive messages, and the `from`
number must be a Twilio number (or a verified caller ID). A failed send returns
`{ "result": { "status": "FAILURE", "error": "..." } }` including the Twilio error code, so the
reason is visible directly in Postman.

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

## Domain rules

- Three administrator tiers: `SUPERADMIN`, `HIGH_LEVEL` (city-wide), `LOW_LEVEL` (own barangay).
- Residents must have granted consent, at least one phone number, and a matching category preference
  to be eligible for a broadcast.
- Report lifecycle: `NEW → ACKNOWLEDGED → RESOLVED | DISMISSED` and `NEW → DISMISSED`.
- Escalation by a `HIGH_LEVEL` admin creates a `DRAFT` alert that still requires confirmation.
- Audit entries are written for logins, broadcasts, report transitions, escalations, and account
  changes; a retention job removes entries older than 365 days.
