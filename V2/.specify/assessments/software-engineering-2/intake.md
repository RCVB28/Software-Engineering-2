# Idea Intake: Web-Based Emergency Broadcast and SMS Alert System

- **Slug**: software-engineering-2
- **Created**: 2026-11-12
- **Updated**: 2026-11-12 (clarifications incorporated)
- **Source**: repo path `docs/Software Engineering 2 Documentation.pdf` (9 pages)
- **Type**: new-capability

## Idea (as captured)

Quoted from the source document (`docs/Software Engineering 2 Documentation.pdf`):

> "Project Name: Web-Based Emergency Broadcast and SMS Alert System … The purpose of this
> document is to define and describe the technical specifications, architectural design,
> functional modules and operational guidelines for the Website Emergency Broadcast and SMS
> Alert System."

> "Scope - Admin dashboard … (1) Alert creation, (2) Selection of target users for the
> broadcast, and (3) Broadcasting Alerts. - Subscriber portal … users registering their
> contact information, managing role/location tags, creating reports for local emergencies,
> and viewing personal alert histories and alert settings. - Messaging APIs … Using APIs from
> telecommunication companies/services … to send alerts to their subscribers via mobile
> phones. - Database/Subscription logic … - DevOps/Testing/Mock server …"

> "Business Implementation - The team wanted to create a safety and security improvement tool
> that will allow for admins to send alert notifications to users via SMS. - As the NDRRMC
> system supplies nation-wide emergency alert assistance, the team surmised that developing a
> dedicated alert system specifically for a more measurable population localized emergencies
> can help improve disaster responses and aid in disaster preparedness."

The document further specifies: target users (LGU IT/superadmin, LGU system administrators,
city mayor as high-level admin, barangay captains as low-level admin, citizens as recipients);
subscriber features (Google login, registration, announcements, SMS account linking, opt in/out);
admin features (CRUD on alerts/accounts, admin dashboard, recipient group selector by role and
location); a tech stack (React + TypeScript, Tailwind CSS, Figma, HTTP/JSON, PostgreSQL + Prisma,
Twilio for SMS, Postman for testing, a11y checklist); non-functional requirements (performance
targets, three-tier admin security, TLS, server-side validation, audit logging, reliability,
scalability, Philippine Data Privacy Act of 2012 compliance); a 9-week development schedule; and a
budget note for Twilio per-message pricing.

## Restated

The team proposes a web-based emergency broadcast platform that lets authorized local
government/administrator users compose and send targeted emergency alerts to subscribers via
SMS (and potentially email/Web Push), paired with a subscriber portal for registration, alert
preferences, and announcement history.

## Origin & Context

- **Raised by**: A team of five students, described in the document as Product Owner, Scrum
  Master, and Project Developers. Individual names and task assignments are documented separately
  in project management documentation and do not affect the system's technical specifications.
- **Trigger**: NDRRMC provides nation-wide emergency alerts, but the team identified a gap for
  localized, measured-population emergencies (fires, floods, evacuations, power outages, security
  threats, medical emergencies) that need faster, location-targeted notifications.
- **Context**: Academic project for the "Software Engineering 2" course. There is currently no
  officially confirmed client or pilot institution; the team will simulate an LGU environment
  with multiple administrative levels and subscriber groups for development and testing. Production
  deployment (and any associated Twilio costs) would be the responsibility of a client or institution.

## Clarifications (Resolved)

- **Client / pilot institution**: None confirmed. Academic, five-student project; LGU environment
  is simulated for development and testing.
- **Deployment scale & volume**: Initial system targets a single LGU with multiple barangays and
  location-based subscriber groups; approximately 100–1,000 subscriber records. Expansion to
  multiple LGUs is out of scope for the initial implementation.
- **SMS consent & cost**: Subscribers voluntarily provide contact information and consent to
  receive emergency SMS; the system records consent for data-privacy compliance. Development uses
  Twilio test credentials and a mock SMS gateway; production messaging costs fall to the deploying
  client or institution.
- **Admin approval workflow**: Three-level structure — Superadmin (LGU IT: full account/system
  access), High-Level Admin (City Mayor: city-wide announcements), Low-Level Admin (Barangay
  Captain: restricted to their barangay). The system shows the message and intended recipients and
  requires confirmation before broadcast. There is no mandatory mayoral approval per barangay-level
  announcement; role-based restrictions plus confirmation are retained.
- **Email / Web Push scope**: SMS is the primary and required channel. Email and Web Push are
  secondary and will be implemented only if sufficient time remains after core SMS functionality;
  they are not required for the initial demonstration.
- **Privacy handling**: Follows the Philippine Data Privacy Act of 2012 (RA 10173) — collect only
  necessary data, record SMS consent, restrict access by role, audit critical admin actions, and
  prevent direct database access by admins. Data retention and deletion policies will be applied.
- **SMS failure / delay fallback**: Failed or timed-out requests are recorded with delivery status;
  pending messages are queued, failed requests retried a limited number of times, successful/failed/
  delayed requests recorded, administrators notified of unsuccessful deliveries, and duplicate
  notifications prevented on retry. The 15-second target is an expected delivery time under normal
  conditions, not a guarantee during provider outages; submission to the messaging API targets
  5 seconds.
- **Mock vs live SMS**: Mock SMS gateway is the primary testing environment and demonstrates
  delivery, failures, and statuses. Twilio test credentials plus Postman validate API connectivity
  without cost. Live paid Twilio delivery is not mandatory for the initial demonstration.
- **Role/location tag source of truth**: Subscribers supply role and location (e.g., barangay,
  building) during registration; values are stored in PostgreSQL and retrieved by the recipient
  group selector. Superadmins can review and manage subscriber records for accuracy.
- **Administrator authentication**: System-managed accounts authenticated with email and password.
  Passwords are securely hashed before storage, the Superadmin creates and manages administrator
  accounts and access levels, and role-based access control restricts functionality by role.
- **Audit-log & data retention**: Administrative audit logs (account modifications, role changes,
  announcement creation, emergency broadcasts) are retained for one year and accessible only to
  authorized administrators, particularly the Superadmin. Subscriber information is retained while
  the account is active or necessary for the system's purpose, then handled under the
  data-retention and deletion policy. The one-year period is a proposed project decision, not a
  statutory requirement of the Philippine Data Privacy Act.
- **OTP phone verification**: Out of initial scope and not a required feature; subscribers provide
  and consent to their phone numbers at registration. OTP may be considered a future enhancement.

## Deferred / Out of Scope

- **Named team members and task assignments**: Deliberately documented in separate project
  management documentation; they do not affect the system's technical specifications.
- **Email and Web Push channels**: Secondary only, implemented solely if time permits after core SMS.
- **Multi-LGU expansion**: Outside the initial single-LGU implementation.
- **OTP phone verification**: Future enhancement only.
