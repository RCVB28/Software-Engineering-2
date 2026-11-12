# Implementation Plan: Localized Emergency Alert & Reporting Platform

**Branch**: `001-emergency-alert-platform` | **Date**: 2026-11-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-emergency-alert-platform/spec.md`

## Summary

Build a two-sided, single-locality emergency alert and reporting platform. A React + TypeScript
(Tailwind CSS) single-page application serves both the subscriber portal and the administrator
dashboard; a Node.js + Express + TypeScript REST API provides business logic; PostgreSQL (accessed
through Prisma ORM) stores residents, administrators, locations, alerts, reports, delivery records,
consent, and audit entries. Administrators authenticate with JWT + bcrypt, residents with Google
OAuth. SMS delivery uses the Twilio API behind a provider abstraction that supports a mock
implementation for demonstrations. Jest + Supertest cover unit and API integration tests, GitHub
Actions runs CI, and the app deploys to Render or Railway.

Primary deliverables: targeted alert broadcast with recipient selection and confirmation,
subscriber self-service portal, local emergency report submission and triage, three-tier
role-based access control, per-recipient delivery tracking with retry, and one-year audit logging.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20 LTS (backend and frontend)

**Primary Dependencies**: React, Tailwind CSS, Express, Prisma ORM, JWT, bcrypt, Twilio SDK,
Google OAuth client, Jest, Supertest

**Storage**: PostgreSQL (relational; managed via Prisma migrations)

**Testing**: Jest (unit) + Supertest (API integration); VS Code REST Client `requests.http` for
manual endpoint checks; provider mock for hermetic tests

**Target Platform**: Web application — modern browsers (Chrome, Edge, Firefox, Safari); Linux
container hosting on Render or Railway

**Project Type**: Web application (frontend + backend)

**Performance Goals**: Alert submitted to messaging provider within 5 s of confirmation; expected
delivery within 15 s under normal conditions; portal/dashboard content load within 3 s; admin
database read/write within 50 ms; dashboard confirmed in 5 s

**Constraints**: HTTPS/TLS in transit; three-tier RBAC; server-side validation of all input;
one-year audit retention; subscriber data restricted by role and data-protection rules; SMS
demonstrated through a mock provider; single locality only

**Scale/Scope**: One locality with multiple barangays and optional building/zone tags;
approximately 100–1,000 resident records; 4 prioritized user stories; ~26 functional requirements

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate (Principle) | Requirement | Plan Compliance |
|------------------|-------------|-----------------|
| I. Code Quality First | Lint/static analysis, single-purpose modules, no dead code | ESLint + TypeScript `strict`; layered backend (routes/services/repositories); no commented-out code |
| II. Test-Driven Development (NON-NEGOTIABLE) | Failing test before implementation; tests pass in CI | Each FR implemented Red-Green-Refactor with Jest/Supertest; CI blocks merge on failures |
| III. Comprehensive Automated Testing | Unit + integration; deterministic/hermetic; coverage measured | Unit tests for services; Supertest API tests; SMS provider mocked; coverage threshold enforced |
| IV. Maintainability & Readability | Clear names, small units, documented interfaces | Typed DTOs/contracts, documented REST contract, ADRs for key decisions |
| V. Simplicity & Continuous Refactoring | YAGNI; continuous refactor; justify dependencies | MVP scope only; no speculative multi-locality/multi-channel; dependencies from approved stack |
| Quality Gates | Lint + static analysis + full test suite; review; coverage/vuln checks | GitHub Actions: lint, typecheck, test, coverage, dependency audit; mandatory PR review |
| Development Workflow | Small focused changes; tests+docs per change; releasable default branch | Small PRs, atomic commits, spec-linked changes, docs updated with code |

**Result**: PASS — no violations. The frontend + backend split is the standard web-application
structure, not added complexity. No complexity exceptions required.

## Project Structure

### Documentation (this feature)

```text
specs/001-emergency-alert-platform/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (REST API contract)
└── tasks.md             # Phase 2 output (/speckit.tasks command — NOT created here)
```

### Source Code (repository root)

All application source code MUST live under the `apps/` folder — never at the repository root. The
root is reserved for repository-level configuration only (CI, manual request files, workspace
manifests, docs).

```text
apps/
├── backend/
│   ├── src/
│   │   ├── config/          # env, database, auth, messaging configuration
│   │   ├── middleware/      # auth, RBAC, validation, audit, error handling
│   │   ├── modules/
│   │   │   ├── auth/        # admin login (JWT/bcrypt), Google OAuth for residents
│   │   │   ├── residents/   # profile, phone numbers, consent, preferences
│   │   │   ├── locations/   # barangays and building/zone tags
│   │   │   ├── alerts/      # creation, recipient selection, confirmation, broadcast
│   │   │   ├── reports/     # submission, triage lifecycle, escalation
│   │   │   ├── admins/      # administrator accounts and roles
│   │   │   ├── audit/       # audit entry recording and retrieval
│   │   │   └── messaging/   # provider abstraction: Twilio + mock, retry, delivery records
│   │   ├── app.ts
│   │   └── server.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── tests/
│       ├── contract/        # API contract tests (Supertest)
│       ├── integration/     # cross-module and provider-mock tests
│       └── unit/            # service and validation unit tests
└── frontend/
    ├── src/
    │   ├── components/      # shared UI components
    │   ├── pages/           # subscriber portal + admin dashboard pages
    │   ├── services/        # REST API client
    │   ├── hooks/           # reusable state/data hooks
    │   ├── types/           # shared TypeScript types/DTOs
    │   └── App.tsx
    └── tests/
        └── components/      # component and flow tests

requests.http            # repo root: version-controlled local API requests
.github/workflows/ci.yml # repo root: lint, typecheck, test, coverage, dependency audit
```

**Structure Decision**: Option 2 — Web application with application source under `apps/backend/`
and `apps/frontend/`. No application source is placed at the repository root. The backend follows
a modular, layered layout (routes → controllers/services → Prisma repositories) to satisfy
maintainability and testability. The frontend separates shared components, pages for the two
experiences, and a typed API client. Tests live in `tests/` under each app so Jest/Supertest
configuration is colocated. Root-level files are limited to repository configuration and docs.

## Complexity Tracking

> No Constitution Check violations. No complexity exceptions are required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | — | — |
