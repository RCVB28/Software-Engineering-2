# Mock SMS Setup — confirm the site can "send" SMS (no Twilio needed)

Use this when you want to prove the **whole SMS path works** — request → validation → provider →
result → delivery records — **without a Twilio account and without sending a real message**. The
`mock` provider is the default and is completely free.

- **Cost:** nothing.
- **Real messages sent:** none.
- **What it proves:** the website can build and hand off an SMS, and record the outcome.
- **What it does *not* prove:** that Twilio accepts your credentials. For that see
  [`TWILIO-SMS-SETUP.md`](./TWILIO-SMS-SETUP.md).

---

## 1. The `.env` file

**Location:** `V2/apps/backend/.env`
(If it does not exist, copy `V2/apps/backend/.env.example` to `.env`.)

Recommended content for a mock run:

```env
# ---- Database ----
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/se2?schema=public

# ---- Auth ----
JWT_SECRET=change-me-in-local-and-ci
JWT_EXPIRES_IN=1h
GOOGLE_CLIENT_ID=

# ---- Messaging: MOCK (no real SMS) ----
MESSAGING_PROVIDER=mock

# Ignored while MESSAGING_PROVIDER=mock — leave blank.
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

# ---- Server ----
PORT=4000
CORS_ORIGIN=http://localhost:5173

# ---- Retry behaviour (used by alert broadcasts) ----
MESSAGING_MAX_RETRIES=3
MESSAGING_RETRY_DELAY_MS=200

# Simulated failures before the mock starts succeeding (0 = always succeed).
MESSAGING_MOCK_FAILURES=0
```

### The settings that matter here

| Key | Value | What it does |
| --- | --- | --- |
| `MESSAGING_PROVIDER` | `mock` | Selects the fake provider. Only `mock` or `twilio` are allowed — anything else stops the server with a clear error. |
| `MESSAGING_MOCK_FAILURES` | `0` | Number of *simulated* failures the mock returns before succeeding. `0` = every send succeeds. Set to e.g. `2` to watch the retry logic work. |
| `MESSAGING_MAX_RETRIES` | `3` | How many attempts a broadcast makes per number before giving up. |
| `MESSAGING_RETRY_DELAY_MS` | `200` | Delay between those attempts, in milliseconds. |
| `TWILIO_*` | empty | Not used in mock mode; leave them blank. |

---

## 2. Apply the config

1. Save `.env`.
2. **Restart the backend** (env is only read at startup):
   ```powershell
   # in V2\apps\backend
   # Ctrl+C to stop the running server, then:
   npm run dev
   ```
   The API comes up on `http://localhost:4000`.

---

## 3. Verify it works

Log in first and capture the JWT (see the login step in `requests.http`, or the Postman walkthrough
in `README.md`). Use the seeded superadmin: **`superadmin@example.com` / `Password123!`**.

### A. Check the active provider (any admin) — free
```http
GET {{baseUrl}}/api/admin/messaging/status
Authorization: Bearer {{token}}
```
Expected:
```json
{
  "provider": "mock",
  "configured": true,
  "missing": [],
  "fromNumber": null,
  "maxRetries": 3,
  "retryDelayMs": 200
}
```

### B. Send a test message (SUPERADMIN) — free, simulated
```http
POST {{baseUrl}}/api/admin/messaging/test
Authorization: Bearer {{token}}
Content-Type: application/json

{ "to": "+639171234567", "body": "LEARW test message" }
```
Expected:
```json
{
  "provider": "mock",
  "to": "+639171234567",
  "body": "LEARW test message",
  "result": { "status": "SUCCESS", "providerMessageId": "mock-<uuid>" }
}
```
`status: "SUCCESS"` with a `mock-...` id means the site's SMS pipeline works end-to-end.

### C. (Optional) Exercise the retry logic
Set `MESSAGING_MOCK_FAILURES=2`, restart, and call the test endpoint **once**. The single request
still succeeds because the mock fails twice then succeeds — mirroring how broadcasts retry. The
per-attempt detail is recorded on broadcast deliveries, not on this one-off endpoint.

### D. (Optional) Prove it through a real broadcast
This is the closest to a genuine alert without sending anything:

1. `POST /api/admin/alerts` — create a draft (see `requests.http`).
2. `GET /api/admin/alerts/<alert-id>/recipients` — preview who would be messaged.
3. `POST /api/admin/alerts/<alert-id>/confirm` — runs the dispatch through the mock provider.
4. `GET /api/admin/alerts/<alert-id>/deliveries` — each recipient shows a `SUCCESS` record with a
   `mock-...` provider message id.

---

## 4. Expected results at a glance

| Situation | What you see |
| --- | --- |
| Correct config | `status` shows `provider: "mock"`, `configured: true` |
| Test send | `result.status: "SUCCESS"`, `providerMessageId: "mock-..."` |
| `MESSAGING_MOCK_FAILURES=1` | First send returns `status: "FAILURE"`, `error: "Simulated provider failure"` |
| Bad phone number | `400` — `to` must be E.164 (`+` then 8–15 digits) |
| Not logged in / wrong role | `401` (no token) or `403` (test endpoint needs SUPERADMIN) |

---

## 5. What mock does and does not prove

| ✅ Proves | ❌ Does not prove |
| --- | --- |
| The app builds a valid E.164 number and message | That Twilio credentials are valid |
| The provider interface and dispatch run correctly | That a real phone receives an SMS |
| Delivery records are written to Postgres | Any Twilio account/rate/trial rules |
| Retries behave as configured | Real carrier delivery |

When you are ready to test the real Twilio API, switch to [`TWILIO-SMS-SETUP.md`](./TWILIO-SMS-SETUP.md).

---

## 6. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Server won't start, message about `MESSAGING_PROVIDER` | Value must be exactly `mock` or `twilio` (case-insensitive). Fix the typo. |
| `status` still shows an old provider | You did not restart after saving `.env`. Stop and run `npm run dev` again. |
| `500 MESSAGING_NOT_CONFIGURED` | You set `MESSAGING_PROVIDER=twilio` but left `TWILIO_*` blank. Either fill them in or set the provider back to `mock`. |
| `400` on the test send | `to` is not E.164. Use `+` then 8–15 digits, e.g. `+639171234567`. Spaces/dashes/parens are stripped automatically. |
| `403` on the test send | You are not logged in as a **SUPERADMIN**. Use `superadmin@example.com`. |
