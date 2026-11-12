# Problem Definition: Localized Emergency Notification for an LGU Community

- **Slug**: software-engineering-2
- **Created**: 2026-11-12
- **Inputs used**: intake.md (research.md not present); user clarifications

## Problem Statement

During localized emergencies — fires, floods, building evacuations, power outages, security
threats, and medical incidents — residents of a specific barangay, building, or community do not
reliably receive timely, location-relevant safety instructions. Nation-wide alerting does not
reach a measurable local population with enough specificity; residents also lack a direct way to
make officials aware of incidents they observe; and local administrators lack both reliable local
incident information and a trustworthy way to ensure the right people are informed and to know
whether those warnings were successfully delivered.

## Affected Users & Stakeholders

- **Users — Residents/subscribers of the LGU or community**: Need prompt, trustworthy guidance
  relevant to their exact location so they can act (evacuate, avoid an area, seek safety), and need
  a direct way to report incidents they observe to the officials responsible for their area;
  currently depend on ad hoc channels and may miss or mistrust warnings.
- **Users — Barangay captains (low-level admins)**: Responsible for informing and responding within
  their own barangay during local incidents but have no dependable mechanism to reach exactly that
  population or to receive local incident information.
- **Users — City mayor (high-level admin)**: Accountable for city-wide emergency communication and
  for ensuring consistent, accurate messaging across the locality.
- **Users — LGU IT staff (superadmin / system administrators)**: Must operate, maintain, and keep
  subscriber records and system integrations reliable and compliant.
- **Stakeholders — Academic instructor/evaluator**: Assesses the project as coursework; influences
  scope and acceptance. (The project remains an academic demonstration; no pilot client is confirmed.)
- **Stakeholders — Data subjects and the privacy regulator**: Have an interest in consent-based,
  lawfully handled personal contact data under the Philippine Data Privacy Act of 2012 (RA 10173).
- **Stakeholders — Prospective adopting LGU/institution (future)**: Would decide adoption and bear
  ongoing operating costs; currently unconfirmed and outside this project's commitments.

## Goals

- Shorten the time between an emergency being recognized by local authorities and affected
  residents receiving actionable, location-specific information.
- Enable authorized local personnel to reach the intended local population (by area and role)
  without depending on broad, nation-wide channels.
- Enable residents to surface observed local incidents to the officials responsible for their area
  so that responses can be informed by local information.
- Give administrators confidence and visibility into whether emergency notifications reached the
  intended recipients.
- Preserve resident trust through consent-based data handling and role-restricted access to
  personal information.

## Non-Goals

- Nation-wide alerting or replacing NDRRMC's national system.
- Supporting multiple LGUs in the initial implementation (single LGU only; multi-LGU is future work).
- Advanced incident-reporting capabilities such as live incident tracking, image verification, and
  automated emergency detection (basic report submission and administrator review are in scope).
- Photo/media attachments for emergency reports are optional and outside core MVP scope (text and
  location are the core report inputs).
- Two-way real-time communication, social features, or a general-purpose messaging platform.
- Email and Web Push as committed channels (secondary, only if time permits after the primary
  notification channel).
- OTP phone verification (future enhancement only).
- Mandatory paid live SMS delivery or a confirmed LGU partnership for the initial demonstration.
- Physical infrastructure such as sirens, loudspeakers, or hardware alerting devices.

## Success Metrics

No verified baseline exists for current local emergency-notification reach or timeliness (the
project is an academic prototype). Effectiveness will be judged through simulated testing against
the following measures:

- Time to submit a notification request to the messaging service (target: at most 5 seconds under
  normal operating conditions).
- Time to process and distribute emergency notifications (target: delivery within 15 seconds under
  normal operating conditions; an expected time, not a guarantee during provider outages).
- Count of successful versus failed message requests, with delivery outcome recorded for 100% of
  broadcast attempts and administrators notified of failures.
- Accuracy of recipient selection based on location and role (qualitative/functional check).
- System response time under normal operating conditions.
- Number of local emergency reports submitted by residents and reviewed by administrators
  (qualitative prototype signal; no baseline).

## Cost of Inaction

If nothing is built, localized emergencies will continue to be communicated through informal,
inconsistent channels. Residents in a specific barangay or building may receive warnings late,
inaccurately, or not at all; observed incidents may go unreported to the officials who could
respond; local officials will have no reliable record of who was informed or whether delivery
succeeded; and the LGU will remain dependent on nation-wide alerts that are not targeted to the
affected community. The likely result is avoidable confusion, delayed action, and preventable harm
during local incidents.

## Open Questions

None remain for the problem definition. The report lifecycle and permissions, report fields, and
location granularity have been resolved and are recorded in `functional-requirements.md`.
