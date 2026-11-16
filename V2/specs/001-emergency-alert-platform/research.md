# Phase 0 Research: Localized Emergency Alert & Reporting Platform

**Feature**: `001-emergency-alert-platform` | **Date**: 2026-11-12

All Technical Context unknowns are resolved by `docs/techstack.md`; this document records the key
technical decisions, rationale, and alternatives for the design phases.

## 1. Application architecture

- **Decision**: Split web application — a React/TypeScript SPA (`apps/frontend/`) calling a Node.js
  + Express + TypeScript REST API (`apps/backend/`) — with PostgreSQL via Prisma. All application
  source lives under `apps/`; the repository root holds only repo-level configuration and docs.
- **Rationale**: Matches the approved stack, keeps the two user experiences (subscriber portal and
  admin dashboard) in one SPA, and keeps business logic and access control server-side where they
  can be tested and enforced.
- **Alternatives considered**: Single full-stack framework (rejected — not in approved stack);
  separate apps per audience (rejected — duplicates build/deploy for a small team).

## 2. Authentication & authorization

- **Decision**: Administrators authenticate with email + password; passwords hashed with bcrypt;
  issued a signed JWT used as a bearer token. Residents authenticate through Google OAuth, after
  which the backend issues the same kind of JWT. Authorization uses role-based middleware plus a
  jurisdiction scope (low-level admins are bound to one barangay).
- **Rationale**: JWT + bcrypt is the approved strategy and fits a stateless REST API. A single token
  pipeline for both audiences reduces complexity; role + scope checks are centralized in middleware.
- **Alternatives considered**: Server-side sessions (rejected — not in stack, adds session store);
  fine-grained policy engine (rejected — overkill for three fixed roles).
- **Test approach**: Unit tests for password hashing and token verification; integration tests use
  signed test tokens and a mocked Google OAuth verification. No live Google calls in CI.

## 3. Role-based access control (three tiers)

- **Decision**: Enforce RBAC centrally with a middleware that maps each route to allowed roles, plus
  a data-scope check. SUPERADMIN: full administrative access. HIGH_LEVEL: all barangays in the
  locality. LOW_LEVEL: only their assigned barangay. Residents: only their own data.
- **Rationale**: Central enforcement prevents scattered checks and satisfies the "admins must not
  access the data store directly" and "restrict by role" requirements. Data-scope checks on queries
  prevent cross-barangay leakage even when a route is allowed.
- **Alternatives considered**: Route-only role checks (rejected — does not prevent low-level admins
  from requesting another barangay's record by ID); database row-level security (rejected — extra
  operational complexity for the scope).

## 4. SMS provider abstraction & mock

- **Decision**: Define a `MessagingProvider` interface with two implementations — `TwilioProvider`
  and `MockProvider`. Select via `MESSAGING_PROVIDER` environment variable. Default to the mock for
  local development, tests, and the demonstration; Twilio test credentials validate real API
  connectivity.
- **Rationale**: Keeps tests deterministic and free, satisfies the "simulated SMS environment"
  assumption, and allows a real provider to be swapped in later without changing business logic.
  Avoids committing the system to paid delivery.
- **Alternatives considered**: Direct Twilio calls everywhere (rejected — non-hermetic tests, cost,
  cannot demonstrate without credentials); a separate mock server process (rejected — more moving
  parts than an in-process implementation).

## 5. Delivery tracking, retry, and duplicate prevention

- **Decision**: Persist one delivery record per (alert, resident, phone number) with status
  `SUBMITTED | SUCCESS | FAILURE | DELAYED`. On submission, record `SUBMITTED`; update on provider
  callback/response. Retry failures a bounded number of times with backoff. Use a deterministic
  idempotency key per delivery to prevent duplicate sends during retries. Notify admins of failures
  through the dashboard.
- **Rationale**: Satisfies FR-009/FR-010 and SC-003 directly, and gives admins the visibility the
  problem definition requires. Idempotency avoids duplicate alerts on retry.
- **Alternatives considered**: Fire-and-forget send (rejected — no visibility); unbounded retries
  (rejected — risk of message storms); a separate queue service (rejected — YAGNI; an in-process
  bounded retry with persisted state is sufficient at the target scale).

## 6. Consent and notification preferences

- **Decision**: Store a consent record at registration and per-category opt-in/opt-out preferences.
  Recipient selection excludes residents who have not consented or who opted out of the alert's
  category.
- **Rationale**: Meets FR-003 and the data-protection requirement, and prevents sending to residents
  who declined.
- **Alternatives considered**: Global opt-out only (rejected — the spec calls for per-category
  choices); consent inferred from registration (rejected — must be explicit and recorded).

## 7. Input validation

- **Decision**: Validate every request server-side with small, hand-written validation helpers that
  return structured errors; enforce enums, required fields, string length (report description ≤500),
  phone format, and role/jurisdiction constraints. Reject unknown/extra fields on writes.
- **Rationale**: Satisfies FR-017/FR-022 without adding a new validation dependency (Constitution V:
  justify dependencies). Keeps validation testable in isolation.
- **Alternatives considered**: Adding Zod/express-validator (deferred — useful but not in the approved
  stack; can be adopted later if hand-rolled helpers become unwieldy).

## 8. Audit logging

- **Decision**: An append-only `AuditEntry` record written by middleware/service calls for critical
  actions (account changes, role changes, alert creation, broadcast confirmation). Retrieve via a
  superadmin/high-level endpoint. Retain for one year and expose a scheduled cleanup.
- **Rationale**: Meets FR-021/SC-009 and supports accountability. Append-only avoids accidental
  mutation; a retention job enforces the one-year decision.
- **Alternatives considered**: Application log files only (rejected — not queryable by admins, not
  reliably retained); full event sourcing (rejected — overkill).

## 9. Data storage & schema management

- **Decision**: PostgreSQL with Prisma schema and migrations; documents stored relationally with
  enums for roles, categories, severities, statuses. Seed script provides barangays and demo users.
- **Rationale**: Relational integrity suits residents, locations, alerts, reports, and delivery
  records; Prisma migration management is in the approved stack and supports reproducible test DBs.
- **Alternatives considered**: Document store (rejected — not in stack, weaker relational integrity
  for jurisdiction and delivery records).

## 10. Testing strategy

- **Decision**: Jest for unit tests and Supertest for API integration tests. Use a dedicated test
  PostgreSQL database reset per run via Prisma migrate, and the mock messaging provider. Contract
  tests assert request/response shapes from `contracts/openapi.yaml`. Add `requests.http` for manual
  checks.
- **Rationale**: Meets the constitution's TDD and comprehensive-testing gates with deterministic,
  hermetic tests. Contract tests keep implementation aligned with the documented API.
- **Alternatives considered**: In-memory SQLite for tests (rejected — differs from PostgreSQL
  behavior); live provider calls (rejected — non-hermetic and costly).

## 11. CI/CD & deployment

- **Decision**: GitHub Actions workflow runs install, lint, typecheck, unit/integration tests,
  coverage threshold, and dependency audit on every push/PR. Deploy backend and frontend to Render
  or Railway with environment-managed secrets (JWT secret, database URL, OAuth and Twilio
  credentials).
- **Rationale**: Enforces the constitution's Quality Gates and keeps secrets out of the repo.
  Matches the approved deployment platforms.
- **Alternatives considered**: Manual deploys (rejected — violates quality gates); container
  orchestration (rejected — unnecessary for scope).

## 12. Security & privacy

- **Decision**: HTTPS/TLS in transit (platform-provided), bcrypt password hashing, server-side input
  validation, role + jurisdiction scoping, no direct database access for administrators, and
  consent/data-minimization records. Delete or anonymize personal data on account removal per the
  retention policy.
- **Rationale**: Meets the spec's security and RA 10173 requirements and the constitution's security
  and testability expectations.
- **Alternatives considered**: Client-side-only validation (rejected — insecure); storing raw
  passwords (rejected — unacceptable).

## 13. Frontend state & structure

- **Decision**: React function components with TypeScript, Tailwind CSS, React hooks and a typed
  fetch-based API client; local component state plus small data hooks. No additional state library.
- **Rationale**: Keeps to the approved stack and the simplest design that works (Constitution V).
- **Alternatives considered**: A global state library (deferred — not needed at this scope).

## 14. Report lifecycle & escalation

- **Decision**: Reports start `NEW`; authorized admins set `ACKNOWLEDGED`, then `RESOLVED` or
  `DISMISSED`; each transition records the actor and time. HIGH_LEVEL admins can escalate a report
  into a draft alert that then follows the normal confirmation flow.
- **Rationale**: Matches the spec and keeps escalation auditable and safe (no immediate broadcast
  without confirmation).
- **Alternatives considered**: Auto-broadcast on escalation (rejected — bypasses confirmation
  requirement); free-form statuses (rejected — untestable).

## 15. Location granularity

- **Decision**: Barangay is the mandatory boundary; residents carry `barangayId` plus an optional
  free-text building/zone tag. Alerts target one or more barangays and/or a role.
- **Rationale**: Matches FR-007/FR-024 and keeps recipient filtering simple and testable without
  geospatial systems.
- **Alternatives considered**: GPS-radius targeting (rejected — added complexity, not required);
  full hierarchy with city/province tables (rejected — single locality scope).

## Resolved Unknowns

No Technical Context item remains `NEEDS CLARIFICATION`. Open questions from the assessment are
captured as assumptions in the spec and validated as design decisions above.
