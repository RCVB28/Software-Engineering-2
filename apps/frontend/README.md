# Frontend SPA

React + TypeScript + Vite + Tailwind single-page app with two experiences:

- **Admin console**: compose and confirm alerts, preview recipients, inspect per-recipient delivery
  results, triage reports, manage administrator accounts (SUPERADMIN), and read the audit log.
- **Resident portal**: Google sign-in, profile and phone management, SMS consent, category
  preferences, announcements, and emergency report submission.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Vite serves on `http://localhost:5173` and proxies `/api` to `http://localhost:4000`.

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | API base path (default `/api`, proxied in development) |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID used to render the sign-in button |

Without `VITE_GOOGLE_CLIENT_ID`, the resident login screen accepts a pasted Google ID token for
local development.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck and production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint for `.ts`/`.tsx` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Jest + Testing Library component tests |

## Notes

- The session token is stored in `localStorage` and attached as a bearer token by the typed API
  client in `src/services/api.ts`.
- Broadcast confirmation is an explicit, confirmation-gated action; drafts can be edited and
  previewed first.
- Low-level administrators only see alerts and reports scoped to their barangay; account management
  and the audit log are hidden in the navigation for unauthorized roles.
