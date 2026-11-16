# Constitution Compliance — 2026-11-12

Feature: `001-emergency-alert-platform` (Localized Emergency Alert & Reporting Platform)
Constitution: v1.0.0

## Principle I — Code Quality

- Backend is organized into config, middleware, types, and feature modules
  (`auth`, `residents`, `alerts`, `messaging`, `reports`, `admins`, `audit`, `locations`), each with
  routes, controllers, services, and validation split by responsibility.
- Strict TypeScript (`strict: true`) in both apps; `tsc --noEmit` and ESLint pass with zero errors.
- Frontend uses a typed API client, shared DTOs, reusable layout/protected-route/status components,
  and no direct `fetch` calls from pages.

## Principle II — Test-Driven Development (NON-NEGOTIABLE)

- Every user story has contract and integration tests (`tests/contract/*`, `tests/integration/*`)
  written from the OpenAPI contract; foundational units cover validation, JWT, recipient
  eligibility, report transitions, dispatch retries/idempotency, and audit retention.
- Implementation tasks in `tasks.md` are ordered tests-first per story. Because this workspace is
  not a git repository, failing-test-first commits cannot be demonstrated; test ordering and the
  preserved test suites provide the evidence.
- DB-backed tests are gated behind `RUN_DB_TESTS=1` so unit tests remain deterministic and hermetic;
  CI enables the gate and provisions PostgreSQL.

## Principle III — Comprehensive Automated Testing

- Unit: 29 passing tests without external services; 73 total tests with the database-backed suite.
- Contract: alert, resident, report, and administrator/audit endpoint suites.
- Integration: targeted broadcast, subscriber portal, report triage, admin RBAC, and a 1,000-resident
  performance smoke test.
- Messaging is always mocked in tests (`MockProvider`); no live Twilio calls.
- Coverage with the full suite: 86.75% statements, 61.19% branches, 87.02% functions, 89.03% lines,
  above the configured thresholds (40/30/40/40).

## Principle IV — Maintainability

- Shared validation helpers (`assert`, `requireString`, enum/phone parsing) and one error envelope
  (`{ message, code?, details? }`) are reused across modules.
- Controllers are thin; business rules live in services that accept the Prisma client for testability.
- Recipient eligibility lives in one service and is reused by preview and confirm.

## Principle V — Simplicity

- Default messaging provider is `mock`; Twilio activates only via `MESSAGING_PROVIDER=twilio`.
- No queues, caches, or extra services; dispatch is synchronous with bounded retries and a
  deterministic idempotency key (`alertId:residentId:phone`).
- A single init migration captures the complete schema.

## Principle VI — Security & Quality Gates

- JWT bearer auth with bcrypt password hashing; role/jurisdiction checks in middleware and services.
- LOW_LEVEL admins are restricted to their barangay for alert targets, alert access, reports, and
  escalation.
- CORS allowlist from `CORS_ORIGIN`; security headers (`X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`); JSON body limit; secrets only via environment.
- Broadcast requires explicit confirmation; audit entries are written for logins, broadcasts,
  report transitions, escalations, and account changes; 365-day retention job included.
- CI runs install, Prisma generate/push, lint, typecheck, tests with coverage, and a production
  dependency audit at high severity.

## Development Workflow

- Spec Kit artifacts (spec, plan, research, data model, OpenAPI contract, quickstart, tasks,
  checklist) are the source of truth.
- Application source lives only under `apps/`; the repository root holds configuration, docs, and
  `requests.http`.
- Demo credentials and environment variables are documented in the READMEs and quickstart.

## Known Gaps

1. The database suite and API-level quickstart flows ran against a temporary embedded PostgreSQL
   18.6 cluster. Browser click-throughs, real Google sign-in, and live Twilio delivery were not
   exercised; see `validation.md`.
2. The hosted CI run must be confirmed after the first push; local execution reproduced every step.
3. Production dependency audit still reports moderate advisories (`uuid` via `google-auth-library`,
   `react-router` 6); neither is rated high, and upgrades are noted as follow-up.
