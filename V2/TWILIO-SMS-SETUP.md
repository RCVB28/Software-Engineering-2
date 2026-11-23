# Twilio SMS Setup — send real SMS from the site

Use this once you have a **Twilio account**. It covers the `.env` values, how to confirm the API is
**connected without sending an SMS**, and how to send one real message.

- **Cost:** a free Twilio signup gives you a **trial** account with a small credit; sending real
  messages is billable.
- **Real messages sent:** only if you run the final "send" step. The connectivity check sends
  **nothing**.
- Looking to test the SMS path for free first? See [`MOCK-SMS-SETUP.md`](./MOCK-SMS-SETUP.md).
- **Twilio signup blocked in your region?** See [`TEXTBEE-SMS-SETUP.md`](./TEXTBEE-SMS-SETUP.md) for
  an Android-phone SMS gateway that avoids Twilio entirely.

---

## 1. Before you start

You need three values from the [Twilio Console](https://console.twilio.com):

| Value | Where to find it | Example |
| --- | --- | --- |
| **Account SID** | Console home → **Account Info** panel | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| **Auth Token** | Same panel → click to reveal, then copy | `your_auth_token_here` |
| **From number** | **Phone Numbers → Manage → Active numbers** (must start with `+`) | `+15551234567` |

Notes:
- There is **no way to connect to Twilio without an account** — the SID + Auth Token *are* the
  connection. The free signup is a **trial** account, and that is fine for testing.
- On a **trial** account you must also **verify the destination number**:
  **Phone Numbers → Manage → Verified Caller IDs → Add a new number**.
- The `From` number must be a Twilio number you own (or a verified caller ID).

---

## 2. The `.env` file

**Location:** `V2/apps/backend/.env`
(If it does not exist, copy `V2/apps/backend/.env.example` to `.env`.)

Change only the messaging block to:

```env
# ---- Messaging: TWILIO (real SMS) ----
MESSAGING_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_FROM_NUMBER=+15551234567
```

Paste the values **without quotes and without spaces**. The rest of the file stays as-is:

```env
# ---- Database ----
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/se2?schema=public

# ---- Auth ----
JWT_SECRET=change-me-in-local-and-ci
JWT_EXPIRES_IN=1h
GOOGLE_CLIENT_ID=

# ---- Server ----
PORT=4000
CORS_ORIGIN=http://localhost:5173

# ---- Retry behaviour ----
MESSAGING_MAX_RETRIES=3
MESSAGING_RETRY_DELAY_MS=200
MESSAGING_MOCK_FAILURES=0
```

### The settings that matter here

| Key | Value | What it does |
| --- | --- | --- |
| `MESSAGING_PROVIDER` | `twilio` | Switches the app from the mock to the real Twilio API. |
| `TWILIO_ACCOUNT_SID` | `AC…` | Twilio account identifier. **Required.** |
| `TWILIO_AUTH_TOKEN` | secret | Twilio API password. **Required.** Keep it private. |
| `TWILIO_FROM_NUMBER` | `+…` | The sender number. **Required.** Must be Twilio-owned or a verified caller ID. |
| `MESSAGING_MAX_RETRIES` | `3` | Attempts per number for alert broadcasts. |
| `MESSAGING_RETRY_DELAY_MS` | `200` | Delay between those attempts (ms). |

If any of the three `TWILIO_*` values is empty, the app fails with a clear
`MESSAGING_NOT_CONFIGURED` error naming the missing variable(s).

---

## 3. Apply the config

1. Save `.env`.
2. **Restart the backend** (env is only read at startup):
   ```powershell
   # in V2\apps\backend
   # Ctrl+C to stop the running server, then:
   npm run dev
   ```
3. Log in and capture the JWT using the seeded superadmin:
   **`superadmin@example.com` / `Password123!`** via `POST /api/auth/admin/login`.

---

## 4. Confirm the connection **without sending an SMS** (free)

Do **both** checks.

### A. Did the app load your Twilio config?
```http
GET {{baseUrl}}/api/admin/messaging/status
Authorization: Bearer {{token}}
```
Expected:
```json
{
  "provider": "twilio",
  "configured": true,
  "missing": [],
  "fromNumber": "+15551234567",
  "maxRetries": 3,
  "retryDelayMs": 200
}
```
- `provider` still `"mock"` → you did not restart, or `.env` was not saved.
- `configured: false` / `missing: [...]` → those variables are still empty.
- ⚠️ `configured: true` only means the variables are **present**, not **valid**. Check B proves that.

### B. Are the credentials actually valid? (free, no SMS)
Call Twilio's REST API directly:

```http
GET https://api.twilio.com/2010-04-01/Accounts/{{AccountSid}}.json
```
**Auth → Basic Auth:** username = **Account SID**, password = **Auth Token**.

| Result | Meaning |
| --- | --- |
| `200` + your account JSON | **Connected — credentials are valid.** ✅ |
| `401` | Wrong Account SID or Auth Token. |

This sends no message and is the cleanest proof that "the API is connected properly".

---

## 5. Send one real SMS (optional, billable)

Only when you want to prove an actual send.

```http
POST {{baseUrl}}/api/admin/messaging/test
Authorization: Bearer {{token}}
Content-Type: application/json

{ "to": "+639171234567", "body": "LEARW test message" }
```

Success:
```json
{
  "provider": "twilio",
  "to": "+639171234567",
  "body": "LEARW test message",
  "result": { "status": "SUCCESS", "providerMessageId": "SMxxxxxxxx..." }
}
```
Failure returns the reason, including the Twilio error code:
```json
{
  "provider": "twilio",
  "to": "+639171234567",
  "body": "LEARW test message",
  "result": { "status": "FAILURE", "error": "The number is unverified (Twilio code 21608)" }
}
```

> The `/test` endpoint requires **SUPERADMIN**. `GET /status` works for any admin.

---

## 6. Reading the result

| Signal | Meaning |
| --- | --- |
| `result.status: "SUCCESS"` + `providerMessageId: "SM…"` | Twilio accepted the message — connected. ✅ |
| `configured: false`, `missing: [...]` | A `TWILIO_*` value is empty → fix `.env` and restart. |
| Twilio code `20003` | Auth failed — wrong Account SID / Auth Token (redo check B). |
| Twilio code `21608` | Trial account: the **destination** number is not verified in Twilio. |
| Twilio code `21211` | Bad `To` number. |
| Twilio code `21606` | The `From` number is not a Twilio/verified number. |
| `400` from your API | `to` is not E.164 (`+` then 8–15 digits). |
| `403` from your API | Not logged in as SUPERADMIN. |
| `500 MESSAGING_NOT_CONFIGURED` | `provider=twilio` but one or more `TWILIO_*` values are blank. |

---

## 7. Trial-account reminders

- Trial accounts can only send to **verified** destination numbers.
- The `From` number must be a Twilio number or a verified caller ID.
- Each real message is **billable**; keep `MESSAGING_PROVIDER=mock` for routine testing.

---

## 8. Switch back to mock

Set `MESSAGING_PROVIDER=mock` (leave `TWILIO_*` as they are, or blank them) and restart. This returns
to the free, simulated provider described in [`MOCK-SMS-SETUP.md`](./MOCK-SMS-SETUP.md).

---

## 9. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Server won't start, `MESSAGING_PROVIDER must be "mock", "twilio" or "textbee"` | Typo in the value. Use exactly `mock`, `twilio`, or `textbee`. |
| `status` shows `provider: "mock"` after editing `.env` | Not restarted, or `.env` not saved. |
| `500 MESSAGING_NOT_CONFIGURED` | One or more `TWILIO_*` values are empty; the error names them. |
| Check B returns `401` | Wrong Account SID / Auth Token. Re-copy both from the Console. |
| Real send returns code `21608` | Verify the destination number in Twilio (trial accounts only). |
| Real send returns code `21606` | `TWILIO_FROM_NUMBER` is not a Twilio-owned/verified number. |
| `400` on the test send | `to` is not E.164, e.g. `+63 (917) 000-0001` → `+6391700000001`. |
