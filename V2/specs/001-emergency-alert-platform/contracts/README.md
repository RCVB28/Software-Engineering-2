# API Contracts

**Feature**: `001-emergency-alert-platform`

The authoritative interface contract is [`openapi.yaml`](./openapi.yaml) (OpenAPI 3.0.3). It defines
every REST endpoint, request/response schema, and error shape. Implementation and Supertest
contract tests MUST conform to it.

## Conventions

- Base path: `/api`.
- Authentication: `Authorization: Bearer <JWT>` for every endpoint except `GET /api/health`,
  `POST /api/auth/admin/login`, and `POST /api/auth/resident/google`.
- Content type: `application/json` (unless `204 No Content`).
- IDs are UUIDs; timestamps are ISO 8601 UTC.
- Errors share the `Error` schema: `{ message, code?, details? }`.
- Validation failures return `400`; missing/invalid auth `401`; role or jurisdiction denial `403`;
  unknown resource `404`; invalid state or duplicate `409`.

## Role and jurisdiction matrix

| Capability | RESIDENT | LOW_LEVEL | HIGH_LEVEL | SUPERADMIN |
|---|---|---|---|---|
| Own profile, phones, consent, preferences | yes | — | — | — |
| View area announcements / own history | yes | — | — | — |
| Submit emergency report | yes | — | — | — |
| Create/broadcast alerts | — | own barangay | whole locality | whole locality |
| Preview recipients / view deliveries | — | own barangay | whole locality | whole locality |
| List/view/triage reports | — | own barangay | whole locality | whole locality |
| Escalate report to alert | — | — | yes | yes |
| Manage administrator accounts | — | — | — | yes |
| View audit trail | — | — | yes | yes |

Jurisdiction is enforced server-side on every query and mutation, not only by route role checks.

## State machines reflected in the contract

- **Alert**: `DRAFT → CONFIRMED → SENDING → COMPLETED`. `POST /api/admin/alerts/{id}/confirm` is the
  only way to send; it rejects confirmation when no eligible recipients exist.
- **EmergencyReport**: `NEW → ACKNOWLEDGED → RESOLVED | DISMISSED` (and `NEW → DISMISSED`).
  `POST /api/admin/reports/{id}/escalate` creates a `DRAFT` alert.
- **DeliveryRecord**: `SUBMITTED → SUCCESS | FAILURE | DELAYED`; retries reuse the same
  idempotency key.

## Contract test expectations

For every path in `openapi.yaml`, at least one Supertest test SHALL assert the success shape and at
least one SHALL assert the documented error code for an unauthorized/forbidden case.
