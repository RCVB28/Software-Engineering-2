# Concept: Localized Emergency Alert & Reporting Platform

- **Slug**: software-engineering-2
- **Created**: 2026-11-12
- **Recommended option**: Option C — Two-Sided Localized Alert & Report Platform

## Options

### Option A — Do nothing / adopt existing tools

- **Sketch**: The LGU continues relying on existing channels — barangay group chats, social media
  pages, and NDRRMC's nation-wide alerts — and the team builds nothing custom. Residents observe
  incidents through the same informal channels and relay them by word of mouth or messaging apps.
- **Appetite**: small (days of setup and coordination).
- **Trade-offs**: Wins by costing almost nothing and requiring no development. Sacrifices every
  outcome the problem calls for: no role hierarchy, no location-targeted reach, no delivery
  visibility, no structured incident reporting, and continued dependence on national alerts.
  Risks: inconsistent adoption, privacy exposure in chat platforms, no auditability.
- **Rabbit holes**: Organizational adoption and moderation of informal channels; accidental scope
  creep into "just build a quick bot" that then needs the same governance it was avoiding.

### Option B — Smallest thing that could work: single-channel SMS broadcaster

- **Sketch**: A single administrator console lets one authorized user choose a barangay/role filter
  and send a short alert through a messaging service. A minimal subscriber registry collects phone
  number, barangay, and role. Residents receive the alert; there is no subscriber portal, no
  incident reporting, and no tiered approval flow.
- **Appetite**: small–medium (days to a few weeks).
- **Trade-offs**: Wins by delivering the core "reach the right local people quickly" outcome with
  the least work and by proving the messaging path and delivery-status handling early. Sacrifices
  resident self-service, incident reporting, multi-tier administration, consent/opt-in management,
  announcement history, and audit depth. Risks: SMS cost/consent handling; limited demonstration
  value against the defined scope.
- **Rabbit holes**: Messaging-provider integration and delivery-status edge cases (timeouts,
  duplicates, retries); handling consent and privacy with only a minimal registry; the temptation to
  bolt on a portal "while we're here" and lose the small appetite.

### Option C — Two-Sided Localized Alert & Report Platform

- **Sketch**: Two connected experiences in one community-scoped system. Residents join through a
  subscriber portal where they register (with Google sign-in), record their barangay/building and
  role, manage alert preferences, view announcements and history, and submit local emergency
  reports. Authorized local officials use an administrator dashboard to compose alerts, target
  recipients by location and role, confirm before broadcasting, and see delivery outcomes; they also
  triage submitted reports through an incident lifecycle with a three-tier administrative hierarchy.
  Messaging is demonstrated through a simulated SMS environment.
- **Appetite**: large (roughly the nine-week schedule described in the source document; ~2+ months).
- **Trade-offs**: Wins across all stated goals — timely targeted notification, resident-to-official
  incident reporting, administrator visibility, and consent/role-restricted trust. Sacrifices speed
  and simplicity, requires more testing/security/privacy effort, and carries real scope-creep risk.
  Risks: role-based access across three tiers; recipient-selection accuracy; report-triage
  completeness; privacy and audit obligations; the simulated messaging environment differing from
  live delivery behavior.
- **Rabbit holes**: Three-tier permissions multiplied across alerts, reports, and accounts; consent
  and audit obligations under data-privacy law; report lifecycle edge cases (reopen, dismiss vs.
  resolve, escalation to an alert); delivery-status/retry semantics in the simulated gateway;
  authentication differences between residents and administrators; optional multi-channel
  notifications creeping into committed scope.

## Recommendation

**Option C — Two-Sided Localized Alert & Report Platform.** It is the only option that addresses all
four problem goals and the success metrics: targeted reach by area and role, resident incident
reporting, administrator delivery visibility, and consent/role-restricted trust. Option B is a
useful fallback or first increment if time runs short (it proves the messaging path and delivery
tracking early), and Option A is the baseline that the cost-of-inaction already argues against. The
recommendation is contingent on keeping the confirmed non-goals out and resisting multi-channel,
multi-LGU, and advanced-reporting expansion.

## Out of Scope (for the recommended option)

- Nation-wide alerting or replacing NDRRMC.
- Multiple LGUs (single simulated LGU only).
- Live incident tracking, image verification, and automated emergency detection.
- Photo/media attachments as core inputs (optional at most).
- Email and Web Push as committed channels (opportunistic only).
- OTP phone verification.
- Mandatory paid live SMS delivery and any confirmed LGU partnership.
- Physical alerting infrastructure (sirens, loudspeakers, hardware).
- Two-way real-time communication, social features, or a general messaging platform.

## Assumptions to Validate

- A simulated single-LGU environment with three administrative tiers is sufficient for the course's
  evaluation in place of a real client or pilot.
- A simulated SMS gateway plus test credentials is acceptable for demonstration; no paid messaging
  is required for acceptance.
- Residents will self-register with representative barangay/role data, and consent records are
  sufficient for privacy compliance in the prototype.
- The one-year audit-log retention decision is acceptable to the evaluator.
- Email and Web Push are genuinely optional and will not be expected at demonstration.
- The nine-week appetite is realistic for a five-member student team alongside coursework; if not,
  Option B's scope should be carved out as the deliverable.
