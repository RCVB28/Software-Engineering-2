# LEARW — V2 (Bugfix Release)

This folder is the **fixed version** of the platform. The repository root is the original program,
kept unchanged as the reference; `V2/` is a copy of it with the fixes applied. For the full,
date-tagged history of every change, see [`DEBUG.md`](./DEBUG.md).

## What changed

All changes are backend-focused, concentrated on the messaging / Twilio path.

| Area | Fix |
| --- | --- |
| Twilio provider | Validates config lazily and fails with a clear `MESSAGING_NOT_CONFIGURED` error naming the missing `TWILIO_*` variable; failure messages now include the Twilio error code (e.g. `21608` unverified number). |
| Provider config | `MESSAGING_PROVIDER` is normalized and validated (unknown values fail fast instead of silently using the mock). Added `MESSAGING_MOCK_FAILURES`. |
| Messaging API | New admin endpoints to test the messaging layer from Postman without composing a broadcast. |
| Provider interface | Added a stable `name`; the mock provider can simulate failures. |
| Dispatch | A throwing provider no longer aborts a broadcast; always at least one attempt. |
| Error handling | Prisma errors map to proper HTTP statuses (409/400/404); malformed JSON returns 400 instead of 500. |

New endpoints:

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| GET | `/api/admin/messaging/status` | any admin | Active provider + whether credentials are complete (no secrets) |
| POST | `/api/admin/messaging/test` | SUPERADMIN | Send one message through the active provider |

Changed files (13 modified, 4 new):

```text
M  apps/backend/.env.example
M  apps/backend/README.md
M  apps/backend/src/app.ts
M  apps/backend/src/config/env.ts
M  apps/backend/src/middleware/error.ts
M  apps/backend/src/modules/messaging/dispatch.service.ts
M  apps/backend/src/modules/messaging/index.ts
M  apps/backend/src/modules/messaging/mock.provider.ts
M  apps/backend/src/modules/messaging/provider.ts
M  apps/backend/src/modules/messaging/twilio.provider.ts
M  apps/backend/tests/setup.ts
M  requests.http
M  specs/001-emergency-alert-platform/contracts/openapi.yaml
A  apps/backend/src/modules/messaging/messaging.controller.ts
A  apps/backend/src/modules/messaging/messaging.routes.ts
A  apps/backend/tests/unit/error-handling.test.ts
A  apps/backend/tests/unit/messaging.test.ts
```

## How to run

Same as the original (see the root `README.md` and `specs/.../quickstart.md`). Minimal setup from
`V2/apps/backend`:

```bash
npm install
cp .env.example .env            # set DATABASE_URL and JWT_SECRET
npx prisma db push
npm run prisma:seed
npm run dev                     # API on :4000 (use a different PORT to run alongside the original)
```

`node_modules` is already present in this folder, so it runs without reinstalling.

## Tests

```bash
cd apps/backend
npm run lint && npm run typecheck && npm test
```

- Unit tests run without a database: **10 suites / 37 tests** (original: 8 / 29).
- Contract/integration tests need PostgreSQL and are gated behind `RUN_DB_TESTS=1`.

## Trying the SMS path (Twilio)

1. Log in as the seeded superadmin: `superadmin@example.com` / `Password123!` via
   `POST /api/auth/admin/login`.
2. `GET /api/admin/messaging/status` — confirm the active provider (no secrets returned).
3. Free dry run with `MESSAGING_PROVIDER=mock`:
   `POST /api/admin/messaging/test` with `{ "to": "+639171234567", "body": "LEARW test" }`.
4. Real SMS: set `MESSAGING_PROVIDER=twilio` plus `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
   `TWILIO_FROM_NUMBER`, restart, and re-send. On a trial account the destination must be verified
   in Twilio first; each message is billable.

Ready-to-run requests are in `V2/requests.http`.
