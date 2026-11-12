# Localized Emergency Alert & Reporting Platform

A two-sided, single-locality emergency alert and reporting platform: a subscriber portal and an
administrator dashboard, backed by a REST API and SMS delivery (Twilio, with a mock provider for
demos).

## Structure

```text
apps/
├── backend/    # Node.js + Express + TypeScript REST API, Prisma, Jest/Supertest
└── frontend/   # React + TypeScript + Vite + Tailwind SPA

specs/001-emergency-alert-platform/   # Spec, plan, data model, contracts, tasks
requests.http                          # Local API requests (VS Code REST Client)
.github/workflows/ci.yml               # CI: lint, typecheck, test, coverage, audit
```

All application source lives under `apps/`; the repository root holds only repo-level config/docs.

## Quick start

See `specs/001-emergency-alert-platform/quickstart.md` for full prerequisites and validation
scenarios. Minimal setup:

```bash
cd apps/backend
npm install
cp .env.example .env            # set DATABASE_URL and JWT_SECRET
npx prisma db push
npm run prisma:seed
npm run dev                     # API on :4000

cd apps/frontend
npm install
cp .env.example .env
npm run dev                     # SPA
```

## Tests

```bash
cd apps/backend && npm run lint && npm run typecheck && npm test
cd apps/frontend && npm run lint && npm run typecheck && npm test
```

Integration tests require a reachable PostgreSQL database (`DATABASE_URL`). The messaging provider
defaults to `mock` so no paid SMS is sent.
