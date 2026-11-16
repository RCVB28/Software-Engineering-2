# Decision: Localized Emergency Alert & Reporting Platform

- **Slug**: software-engineering-2
- **Decided**: 2026-11-12
- **Verdict**: go
- **Artifacts reviewed**: intake.md | research.md (absent) | problem.md | concept.md | functional-requirements.md

## Scorecard

| Criterion | Rating | Justification |
|-----------|--------|---------------|
| Problem validity | strong | A specific, credible pain: residents in a given barangay/building do not reliably receive timely, location-specific emergency instructions, and officials lack both local incident information and delivery visibility. |
| Evidence strength | adequate | Grounded in a detailed 9-page source specification plus explicit stakeholder clarifications. No independent field research or verified baseline exists, so evidence is documentary rather than validated; adequate for an academic prototype, not for a production case. |
| Value vs. inaction | strong | problem.md's cost of inaction is concrete and high: late/missed warnings, unreported incidents, no delivery visibility, continued reliance on non-localized national alerts. |
| Feasibility / appetite | adequate | A single-LGU, simulated-SMS approach is credible for a five-member team within the ~9-week appetite; the full two-sided scope is large and depends on disciplined scope control. |
| Strategic fit | adequate | Aligns with the project constitution's emphasis on quality, testing, and maintainability, and with the course's Software Engineering 2 goals; no conflict with stated non-goals. |
| Risk posture | adequate | Major risks are identified (three-tier permissions, recipient-selection accuracy, report lifecycle, privacy/audit, simulated-vs-live messaging, scope creep) with plausible mitigations (simulation, mock gateway, explicit non-goals); some remain unmitigated until specification. |

## Verdict & Rationale

**Go.** Problem validity and value vs. inaction are strong, evidence is adequate for an academic
prototype, and a recommended concept (Option C, chosen and locked by the user) exists within a
credible appetite. The main reservations — documentary-only evidence, no verified baseline, and a
large two-sided scope — are acknowledged rather than glossed over; they translate into scope
discipline and assumptions to validate during specification, not blockers. Option A (do nothing) is
rejected because it leaves the problem unsolved; Option B is a viable fallback/first increment but
does not cover the incident-reporting and visibility goals.

**Acknowledged unknowns:** no external research or measured baseline (`research.md` absent); no
confirmed pilot client; feasibility rests on the stated nine-week schedule holding.

## If go — Handoff to `/speckit.specify`

- **Problem**: Residents of a specific LGU barangay/building do not reliably receive timely,
  location-specific emergency instructions, and local officials lack local incident information and
  notification-delivery visibility.
- **Chosen approach**: Option C — a two-sided, single-LGU platform: subscriber portal (registration
  with Google sign-in, barangay/building/role profile, preferences, announcements/history, emergency
  report submission) plus admin dashboard (three-tier roles, alert creation, location+role recipient
  selection, confirm-before-broadcast, delivery outcomes, report triage lifecycle), demonstrated on
  a simulated SMS environment.
- **In scope**: single LGU; subscriber registration/portal; SMS as primary channel (mock/test
  gateway); alert creation and targeted broadcast with confirmation; three-tier admin RBAC; basic
  emergency report submission and admin triage (NEW/ACKNOWLEDGED/RESOLVED/DISMISSED); delivery-status
  tracking; consent recording and one-year audit logs; PostgreSQL-backed data with role/location
  targeting.
- **Out of scope**: multi-LGU; nationwide/NDRRMC replacement; live incident tracking, image
  verification, automated detection; photo/media as core inputs; email/Web Push as committed
  channels; OTP verification; mandatory paid live SMS; confirmed LGU partnership; physical alerting
  infrastructure; two-way real-time/social features.
- **Success metrics**: notification request submitted within 5 s; delivery expected within 15 s under
  normal conditions; 100% of broadcast attempts with recorded outcome and admin notification on
  failure; location/role recipient-selection accuracy; acceptable system response time; reports
  submitted and reviewed (qualitative).
- **Carried-forward open questions**: none blocking. Assumptions to validate during specification:
  simulated single-LGU environment suffices for evaluation; mock/test SMS is acceptable; self-provided
  subscriber data is representative; one-year audit retention is acceptable; the nine-week appetite
  holds (otherwise deliver Option B scope first).
