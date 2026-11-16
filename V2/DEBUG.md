# LEARW — Debug Log

Running log of debugging and fixes. Newest entries are appended at the bottom.
Each entry is tagged `DEBUGGING - <date>` so the history stays easy to scan.

## Repository layout
- **Repository root** — the **original program**, kept untouched as the reference. It is pinned
  at commit `17c8795 "before bugfixing"`.
- `V2/` — the **fixed program**: a copy of the original with every adjustment below applied,
  plus this log and `GUIDE.md`. Run and test the fixes from here.

Locally the git clone lives in `V1/`, so the fixed version sits at `V1/V2/`. To compare side by
side, run the backend from the repo root (`apps/backend`, original) and from `V2/apps/backend`
(fixed).

Related docs (the fixed versions live in `V2/`):
- `V2/GUIDE.md` — how to stage and push the V2 folder.
- `V2/apps/backend/README.md` — backend setup and the SMS/Twilio verification section.
- `V2/requests.http` — ready-to-run Postman / VS Code REST Client requests.
- `V2/specs/001-emergency-alert-platform/contracts/openapi.yaml` — API contract.

---

## DEBUGGING - 2026-11-16

### Scope
Full review of the **backend** (originally `V1/apps/backend`) with emphasis on the messaging /
Twilio path, because that is where the issues were concentrated. Every change was kept
consistent with the existing structure and verified with `typecheck`, `lint`, and the unit
test suite. The fixes now live in **`V2/`**; `V1/` is the untouched original.

> Relocation note (same date): the fixes were first applied in place under `V1/`. They were then
> moved into `V2/` so `V1/` can serve as a clean reference. `V1/` was restored to its
> `before bugfixing` commit, and the fixed tree was copied to `V2/`.

### Environment baseline (before changes)
| Check | Command | Result |
| --- | --- | --- |
| Types | `npm run typecheck` | PASS |
| Lint | `npm run lint` | PASS |
| Tests | `npm test` | PASS — 8 suites / 29 tests (9 DB suites skipped) |

Install note: this environment's npm blocks lifecycle scripts, so `prisma generate` did not
run automatically. It was run manually with `npx prisma generate` (Prisma Client v6.19.3).

### Issues found and fixed

#### 1. Twilio provider was brittle and gave no clear signal when unconfigured
`src/modules/messaging/twilio.provider.ts`
- Previously the Twilio client was created eagerly and failures surfaced as a generic 500
  with no indication of *which* environment variable was missing.
- Now the provider exposes `name = 'twilio'`, exports `missingTwilioConfig()` to list every
  empty `TWILIO_*` value, and the constructor throws a clear
  `AppError(500, 'MESSAGING_PROVIDER=twilio requires ...', 'MESSAGING_NOT_CONFIGURED')`.
- `send()` now appends the Twilio error code to the failure message, e.g.
  `"The number is unverified (Twilio code 21608)"`, which makes trial-account problems
  obvious in the API response.

#### 2. `MESSAGING_PROVIDER` was not validated
`src/config/env.ts`
- Added `parseMessagingProvider()`: trims, lowercases, and **fails fast** on any value other
  than `mock` / `twilio`. A typo like `Twilio ` no longer silently falls back to the mock
  provider.
- Added `MESSAGING_MOCK_FAILURES` so retry logic can be exercised deterministically.

#### 3. No way to test the messaging layer directly from Postman
New files: `src/modules/messaging/messaging.controller.ts`, `src/modules/messaging/messaging.routes.ts`
- `GET /api/admin/messaging/status` (any admin) — reports the active provider, whether its
  credentials are complete, the `from` number, and retry settings. **No secrets are returned.**
- `POST /api/admin/messaging/test` (SUPERADMIN only) — sends one message through the active
  provider without composing a broadcast. Normalizes `to` to E.164 via `normalizePhone`, and
  returns `{ provider, to, body, result }`.
- Mounted in `src/app.ts` (`app.use('/api', messagingRouter)`).
- Added `getProviderInfo()` to `src/modules/messaging/index.ts`.

#### 4. Provider interface lacked a stable identifier
`src/modules/messaging/provider.ts`, `mock.provider.ts`
- Added `readonly name: string` to `MessagingProvider`; `MockProvider` reports `'mock'`.
- `mockProvider` now respects `MESSAGING_MOCK_FAILURES` so the default provider can simulate
  failures for testing.

#### 5. Dispatch retry loop could be broken by a throwing provider
`src/modules/messaging/dispatch.service.ts`
- `provider.send()` is now wrapped in `try/catch`; a provider that throws records a `FAILURE`
  and retries instead of aborting the whole broadcast.
- `maxAttempts = Math.max(1, env.MESSAGING_MAX_RETRIES)` guarantees at least one attempt even
  if the env value is `0` or negative.

#### 6. Error handler returned 500 for client mistakes
`src/middleware/error.ts`
- Added Prisma error mapping: `P2002` → 409 `DUPLICATE`, `P2003` → 400 `VALIDATION_ERROR`,
  `P2025` → 404 `NOT_FOUND`.
- Framework errors (e.g. malformed JSON from `express.json`) now map their `status`/`statusCode`
  to a 4xx response (`BAD_REQUEST`) instead of a misleading 500.

### Documentation updated
- `apps/backend/.env.example` — Twilio notes + `MESSAGING_MOCK_FAILURES=0`.
- `apps/backend/README.md` — new endpoints and Twilio trial-account notes.
- `requests.http` — messaging status/test requests added.
- `specs/.../contracts/openapi.yaml` — `/api/admin/messaging/status` and
  `/api/admin/messaging/test` added with `MessagingStatus`, `MessagingTestRequest`,
  `MessagingTestResult` schemas.

### Tests added
- `tests/unit/messaging.test.ts` — status endpoint, auth requirement, normalized test send,
  invalid-number rejection, superadmin-only enforcement, and Twilio config validation.
- `tests/unit/error-handling.test.ts` — malformed JSON returns 400, not 500.
- `tests/setup.ts` — clears `TWILIO_*` env vars so tests never depend on local credentials.

### Verification (after changes)
| Check | Command | Result |
| --- | --- | --- |
| Types | `npm run typecheck` | PASS |
| Lint | `npm run lint` | PASS |
| Tests | `npm test` | PASS — 10 suites / 37 tests (9 DB suites skipped) |

### Known limitation (local environment)
The DB-backed integration/contract suites are gated behind `RUN_DB_TESTS=1` and need a running
PostgreSQL. This machine has **no PostgreSQL** (port 5432 refused), **no Docker**, and **no WSL**,
so those suites were skipped and `npm run test:coverage` reports below-threshold numbers purely
because of the skipped tests. With a database available, `validation.md` records the full suite
as **17 suites / 73 tests** and **86.75% statement coverage**. Run it with:

```powershell
$env:RUN_DB_TESTS = '1'
npm run test:coverage
```

### How to verify Twilio through Postman
1. Log in as the seeded superadmin to get a JWT:
   `POST /api/auth/admin/login` → `{ "email": "superadmin@example.com", "password": "Password123!" }`
   (see `prisma/seed.ts`).
2. Confirm the active provider (no secrets returned):
   `GET /api/admin/messaging/status` with `Authorization: Bearer <token>`.
3. Free dry run first: keep `MESSAGING_PROVIDER=mock`, then
   `POST /api/admin/messaging/test` → `{ "to": "+639171234567", "body": "LEARW test message" }`.
4. Real SMS: set `MESSAGING_PROVIDER=twilio` plus `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
   and `TWILIO_FROM_NUMBER` in `.env`, restart the server, and re-send the test request.
   - On a **trial** account the destination number must be **verified in Twilio** and the
     `from` number must be a Twilio number / verified caller ID; otherwise Twilio returns
     error `21608` (unverified number), which the response now surfaces.
   - Each message is billable (per-message cost), so use the mock provider for everyday runs.

### Running the original vs the fixed version side by side
Both apps default to port `4000`, so change `PORT` in one of their `.env` files before starting
both. From each app's `apps/backend` folder:

```powershell
npm run dev     # original at PORT=4000, V2 at PORT=4001 — adjust as needed
```

`V2/apps/backend/node_modules` was copied from the original, so V2 runs without reinstalling. If
you ever reinstall it, remember this environment blocks install scripts — run `npx prisma generate`
by hand.

### Notes for the next append
- Add a new `## DEBUGGING - <date>` section below this one.
- The repo root is the original program (commit `17c8795`); `V2/` is the fixed program + this log.
- `V2/` is committed on branch `add-v2` of `RCVB28/Software-Engineering-2` for teammates to review.
