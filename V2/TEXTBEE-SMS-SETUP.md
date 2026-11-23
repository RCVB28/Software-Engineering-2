# textbee SMS Setup — send real SMS through your own Android phone

Use this when Twilio is not available in your region. **textbee.dev** is an open-source SMS gateway
that turns an **Android phone into the sender**: the API pushes each message to your phone, and the
phone sends it through **its own SIM**. No carrier account, no number rental, no A2P registration.

- **Cost:** free tier — 300 messages/month, 50/day, 1 device, no credit card.
- **Real messages sent:** only if you run the send step; the connectivity check sends nothing.
- Want a no-account dry run instead? See [`MOCK-SMS-SETUP.md`](./MOCK-SMS-SETUP.md).

> **Hard requirement:** a **physical Android phone with an active SIM**, kept online, with the
> textbee app installed and registered. The app is not optional — the phone *is* the gateway.
> (This works with the cloud service and with a self-hosted server.)

---

## 1. Before you start

1. **Create an account** — <https://app.textbee.dev/register> (email verification only; no carrier
   KYC, so regional restrictions that block Twilio usually do not apply here).
2. **Install the Android app** on the phone — <https://textbee.dev/download>.
3. **Generate an API key** — dashboard → **API Keys** → create one. Copy it.
4. **Register the phone** — open the app and scan the QR code from the dashboard (or paste the key),
   then **enable the gateway**. The device appears in the dashboard **Devices** panel.

You need **one** value: the **API key**. Optionally the **device id** (only if you have several
phones) and a **base URL** (only for a self-hosted instance).

---

## 2. The `.env` file

**Location:** `V2/apps/backend/.env`
(If it does not exist, copy `V2/apps/backend/.env.example` to `.env`.)

Change only the messaging block to:

```env
# ---- Messaging: TEXTBEE (real SMS via your Android phone) ----
MESSAGING_PROVIDER=textbee
TEXTBEE_API_KEY=your_api_key_here
TEXTBEE_DEVICE_ID=
TEXTBEE_BASE_URL=
```

Paste the key **without quotes and without spaces**. The rest of the file stays as-is:

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
| `MESSAGING_PROVIDER` | `textbee` | Switches the app to the textbee API. |
| `TEXTBEE_API_KEY` | key | Your textbee API key. **Required.** Keep it private. |
| `TEXTBEE_DEVICE_ID` | device id | Optional. The phone that sends. Omit to use your account default. |
| `TEXTBEE_BASE_URL` | URL | Optional. Override the API base (default `https://api.textbee.dev/api/v1`) for a self-hosted server. |
| `MESSAGING_MAX_RETRIES` | `3` | Attempts per number for alert broadcasts. |
| `MESSAGING_RETRY_DELAY_MS` | `200` | Delay between those attempts (ms). |

If `TEXTBEE_API_KEY` is empty, the app fails with a clear `MESSAGING_NOT_CONFIGURED` error.

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

### A. Did the app load your textbee config?
```http
GET {{baseUrl}}/api/admin/messaging/status
Authorization: Bearer {{token}}
```
Expected:
```json
{
  "provider": "textbee",
  "configured": true,
  "missing": [],
  "fromNumber": null,
  "deviceId": null,
  "maxRetries": 3,
  "retryDelayMs": 200
}
```
- `provider` still `"mock"` → you did not restart, or `.env` was not saved.
- `configured: false` / `missing: ["TEXTBEE_API_KEY"]` → the key is still empty.

### B. Is the API key valid, and is the phone online? (free, no SMS)
Call textbee's REST API directly:

```http
GET https://api.textbee.dev/api/v1/gateway/stats
x-api-key: {{TEXTBEE_API_KEY}}
```
| Result | Meaning |
| --- | --- |
| `200` + your totals | **Connected — the API key is valid.** ✅ |
| `401` | Missing, invalid, or revoked API key. |

Even better, list your phones and confirm one is registered and reporting:
```http
GET https://api.textbee.dev/api/v1/gateway/devices
x-api-key: {{TEXTBEE_API_KEY}}
```
Look for `"enabled": true` and a recent `lastHeartbeat`. A stale heartbeat means the phone is
offline and messages will queue.

> This is a **stronger** connectivity proof than Twilio's: it validates the key *and* the whole send
> path up to the phone, still without sending anything.

---

## 5. Send one real SMS (optional)

```http
POST {{baseUrl}}/api/admin/messaging/test
Authorization: Bearer {{token}}
Content-Type: application/json

{ "to": "+639171234567", "body": "LEARW test message" }
```

Success:
```json
{
  "provider": "textbee",
  "to": "+639171234567",
  "body": "LEARW test message",
  "result": { "status": "SUCCESS", "providerMessageId": "66b1f2c3a4d5e6f7a8b9c0d2" }
}
```
The `providerMessageId` is textbee's **batch id** — use it to follow delivery in the dashboard.
Failure returns the reason and HTTP status:
```json
{
  "provider": "textbee",
  "to": "+639171234567",
  "body": "LEARW test message",
  "result": { "status": "FAILURE", "error": "textbee: No enabled device found. (HTTP 400)" }
}
```

> The `/test` endpoint requires **SUPERADMIN**. `GET /status` works for any admin.

---

## 6. Reading the result

| Signal | Meaning |
| --- | --- |
| `result.status: "SUCCESS"` + `providerMessageId` | textbee queued the batch — connected. ✅ |
| `configured: false`, `missing: ["TEXTBEE_API_KEY"]` | The API key is empty → fix `.env` and restart. |
| `HTTP 400` — "No enabled device found" | No phone is registered/enabled; finish step 1.4. |
| `HTTP 400` — recipient contains letters | `to` must be a number, not a sender name. |
| `HTTP 401` | API key missing/invalid/revoked. |
| `HTTP 403` | This account cannot send or receive messages. |
| `HTTP 429` | Daily/monthly/per-batch plan limit reached. Nothing was sent. |
| `400` from your API | `to` is not E.164 (`+` then 8–15 digits). |
| `403` from your API | Not logged in as SUPERADMIN. |
| `500 MESSAGING_NOT_CONFIGURED` | `provider=textbee` but `TEXTBEE_API_KEY` is blank. |

**A `200`/`SUCCESS` means textbee accepted and queued the message — not that it was delivered.**
The phone still has to be online **and the SIM must have enough prepaid load/credit**; check the
dashboard for `pending → sent → delivered`. The backend writes `DeliveryStatus.SUCCESS` as soon as
textbee accepts the batch — it cannot see a later carrier rejection, which textbee reports only in
the app/dashboard.

---

## 7. Free-tier reminders

- Free plan: **50 messages/day**, **300/month**, **1 device**.
- The phone must stay online; offline messages queue until it returns.
- SMS goes out on the phone's own carrier plan, so normal carrier SMS rates may apply to that SIM.
- **The SIM needs prepaid load/credit.** With no load, textbee still accepts the batch and our API
  returns `SUCCESS`, but the app shows "Failed to send" — see the troubleshooting table below.

---

## 8. Switch back to mock

Set `MESSAGING_PROVIDER=mock` (leave the `TEXTBEE_*` values as they are) and restart. This returns to
the free, simulated provider in [`MOCK-SMS-SETUP.md`](./MOCK-SMS-SETUP.md).

---

## 9. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Server won't start, `MESSAGING_PROVIDER must be "mock", "twilio" or "textbee"` | Typo in the value. Use exactly `mock`, `twilio`, or `textbee`. |
| `status` shows `provider: "mock"` after editing `.env` | Not restarted, or `.env` not saved. |
| `500 MESSAGING_NOT_CONFIGURED` | `TEXTBEE_API_KEY` is empty. |
| Check B returns `401` | Wrong/revoked API key. Re-copy from the dashboard. |
| Check B works but send returns `400` | No enabled device — install/register the app and enable the gateway. |
| Messages stay `pending` | The phone is offline, has no signal, or the app's SMS permission is off. |
| API returned `SUCCESS` but the app says "Failed to send" | The SIM has no load/credit, no signal, or the phone is in power-save mode. `SUCCESS` only means textbee queued the batch; the carrier rejection is reported later by the app. |
| `429` | Free-plan limit reached (50/day, 300/month). |
