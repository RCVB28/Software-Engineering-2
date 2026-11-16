# Feature Specification: Localized Emergency Alert & Reporting Platform

**Feature Branch**: `001-emergency-alert-platform`

**Created**: 2026-11-12

**Status**: Draft

**Input**: User description: "Localized Emergency Alert & Reporting Platform (assessed concept Option C — two-sided, single-LGU platform with a subscriber portal and an administrator dashboard; decision: go)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Broadcast a Targeted Emergency Alert (Priority: P1)

An authorized administrator composes an emergency alert, selects the intended recipients by
barangay and/or role, reviews the message and the recipient list, confirms the broadcast, and the
system delivers the alert to those recipients through the primary SMS channel while recording the
outcome for each recipient.

**Why this priority**: This is the core purpose of the product. Without timely, targeted delivery of
emergency instructions, none of the other capabilities deliver value. It is the minimum viable
product on its own.

**Independent Test**: An administrator can create and confirm an alert targeted to a single
barangay/role using pre-seeded subscribers, and the system records a delivery outcome for every
intended recipient — with no subscriber portal or report features implemented.

**Acceptance Scenarios**:

1. **Given** an administrator creating an alert, **When** they select a barangay and/or role, **Then** the system shows only subscribers matching the selected criteria as intended recipients.
2. **Given** an alert with a message and intended recipients, **When** the administrator confirms the broadcast, **Then** the system submits the alert to the messaging service and records a delivery outcome for each recipient.
3. **Given** an alert that has not been confirmed, **When** the administrator leaves or cancels the flow, **Then** no message is sent.
4. **Given** a selected target group with zero matching subscribers, **When** the administrator attempts to confirm, **Then** the system prevents the broadcast and explains that there are no recipients.

---

### User Story 2 - Register and Use a Subscriber Portal (Priority: P2)

A resident signs in with their Google account, completes a profile with contact number, primary
barangay, optional building/zone, and role, records consent to receive emergency alerts, and can
view announcements for their area, review their alert history, and manage their alert preferences.

**Why this priority**: The subscriber base is what makes targeted delivery meaningful, and
self-service profiles keep recipient data accurate. It can be delivered after the core broadcast
flow using seeded data.

**Independent Test**: A resident can register, complete their profile and consent, and then view
announcements and their history; delivery targeting in User Story 1 then uses these profiles.

**Acceptance Scenarios**:

1. **Given** a new resident, **When** they sign in and submit required profile information with consent, **Then** their profile is stored with their barangay, role, and consent record.
2. **Given** a registered resident, **When** they open the subscriber portal, **Then** they see announcements relevant to their area and their personal alert history.
3. **Given** a resident who updates their alert preferences, **When** a later alert is broadcast, **Then** the resident's opt-in/opt-out choices are respected.
4. **Given** a resident linking an additional phone number, **When** they save it, **Then** the number is associated with their account and used for delivery.

---

### User Story 3 - Submit and Triage Local Emergency Reports (Priority: P2)

A resident submits a report about a local emergency with a category, severity, description, and
location. An authorized administrator in the relevant jurisdiction reviews the report and moves it
through its lifecycle until it is resolved or dismissed, and a city-wide administrator can escalate
a report into an official alert.

**Why this priority**: Resident-sourced incident information complements official alerts and closes
the loop between residents and responders. It is valuable but secondary to alert delivery.

**Independent Test**: A resident can submit a valid report that becomes visible to the correct
jurisdiction administrator, who can update its status; a low-level administrator cannot act on
reports outside their barangay.

**Acceptance Scenarios**:

1. **Given** a resident, **When** they submit a valid report with required fields, **Then** the report is stored with a NEW status.
2. **Given** a report in their jurisdiction, **When** an authorized administrator reviews it, **Then** they can set it to ACKNOWLEDGED, RESOLVED, or DISMISSED.
3. **Given** a report, **When** a high-level administrator chooses to escalate, **Then** the report can become an official alert subject to the normal confirmation step.
4. **Given** a low-level administrator, **When** they attempt to view or update a report in another barangay, **Then** access is denied.

---

### User Story 4 - Administer Roles and Enforce Access Boundaries (Priority: P3)

The highest-level administrator manages administrator accounts and their roles. High-level
administrators act across the whole locality, low-level administrators act only within their own
barangay, and all administrative actions are recorded for accountability.

**Why this priority**: Role separation and accountability are required for trust and privacy, but
a single seeded administrator can validate the core flows before full administration exists.

**Independent Test**: A superadmin can create administrator accounts with each role; a low-level
administrator is blocked from another barangay's data; critical actions appear in the audit log.

**Acceptance Scenarios**:

1. **Given** a superadmin, **When** they create an administrator account and assign a role, **Then** the account has exactly the permissions of that role.
2. **Given** a low-level administrator, **When** they attempt an action outside their assigned barangay, **Then** the system denies the action.
3. **Given** any administrator, **When** they perform a critical action (account change, role change, alert creation, or broadcast), **Then** the action is written to an audit record retained for at least one year.

---

### Edge Cases

- When the SMS channel fails or times out for a recipient, the system records the failure, retries a limited number of times, notifies an administrator of failures, and does not send duplicate messages on retry.
- When a resident has opted out of a category, they are excluded from that category's broadcasts but remain eligible for others.
- When a resident provides multiple phone numbers, all consented numbers on the account are used for delivery.
- When location capture (GPS) is unavailable during a report, the resident can supply a structured address instead.
- When a report description exceeds the maximum length, the system rejects submission with a clear validation message.
- When a low-level administrator's barangay has no reports or subscribers, the interface shows an empty state rather than an error.
- When an alert's intended recipients change after review but before confirmation, the system re-displays the updated recipient list before sending.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Residents MUST be able to register and sign in to the subscriber portal using their existing Google account.
- **FR-002**: Residents MUST be able to provide and update a profile containing a phone number, a mandatory primary barangay, an optional building/zone tag, and a role.
- **FR-003**: The system MUST record each resident's consent to receive emergency SMS notifications and MUST honor opt-in/opt-out choices per alert category.
- **FR-004**: Residents MUST be able to view announcements relevant to their area and their personal alert history and settings.
- **FR-005**: Residents MUST be able to link one or more phone numbers to their account.
- **FR-006**: Authorized administrators MUST be able to create, edit, and broadcast emergency alerts.
- **FR-007**: The system MUST provide a recipient group selector that filters subscribers by barangay, role, or a combination of both.
- **FR-008**: Before sending any alert, the system MUST display the message and the intended recipients and MUST require explicit administrator confirmation.
- **FR-009**: The system MUST submit confirmed alerts to the messaging service and record a delivery outcome (submitted, success, failure, or delayed) for every intended recipient.
- **FR-010**: The system MUST notify administrators of failed deliveries and MUST prevent duplicate notifications when retrying.
- **FR-011**: The system MUST enforce three administrator roles: a superadmin with full administrative access, a high-level administrator responsible for the entire locality, and a low-level administrator restricted to their assigned barangay.
- **FR-012**: The superadmin MUST be able to create and manage administrator accounts and assign roles.
- **FR-013**: Administrators MUST NOT access the data store directly; all administrative operations MUST be performed through the dashboard.
- **FR-014**: Residents MUST be able to submit an emergency report containing a category, a severity level, a free-text description, and a location.
- **FR-015**: The emergency report category MUST be one of: Fire, Flood, Medical, Security Threat, Power Outage, Infrastructure Damage, or Other.
- **FR-016**: The emergency report severity level MUST be one of: Low, Medium, High, or Critical.
- **FR-017**: The emergency report description MUST be limited to 500 characters and MUST be validated before storage.
- **FR-018**: The system MUST store submitted reports with a NEW status and make them visible to authorized administrators for the relevant jurisdiction.
- **FR-019**: Authorized administrators MUST be able to update a report's status to ACKNOWLEDGED, RESOLVED, or DISMISSED.
- **FR-020**: A high-level administrator MUST be able to escalate a report into an official alert.
- **FR-021**: The system MUST record critical administrative actions — account changes, role changes, alert creation, and broadcasts — in an audit trail retained for at least one year and accessible to authorized administrators.
- **FR-022**: The system MUST validate all user input before accepting it.
- **FR-023**: The system MUST restrict access to resident personal information according to administrator role and applicable data-protection requirements.
- **FR-024**: The system MUST operate within a single locality containing multiple barangays; support for multiple localities is out of scope.
- **FR-025**: The system MUST support an optional media attachment on reports only if the core text-and-location reporting is complete.
- **FR-026**: Residents MUST authenticate with Google, while administrators MUST authenticate with system-managed email-and-password accounts.

### Key Entities *(include if feature involves data)*

- **Resident (Subscriber)**: A person who receives alerts; has contact numbers, a primary barangay, an optional building/zone tag, a role, consent records, and alert preferences.
- **Administrator**: A system user with one role (superadmin, high-level, or low-level); low-level administrators are bound to a specific barangay.
- **Barangay/Location**: The minimum administrative boundary within the single locality; may have optional building/zone detail.
- **Emergency Alert (Announcement)**: An emergency message with content, target criteria (barangay and/or role), sender, confirmation state, and per-recipient delivery outcomes.
- **Emergency Report**: A resident-submitted incident with category, severity, description, location, submitting resident, timestamps, and a lifecycle status.
- **Delivery Record**: The outcome of attempting to notify a specific recipient for a specific alert.
- **Audit Entry**: A record of a critical administrative action with actor, action, and timestamp.
- **Consent Record**: A resident's recorded consent to receive notifications and its current state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An authorized administrator can compose, target, review, and confirm an alert in under 2 minutes.
- **SC-002**: After confirmation, an alert is submitted to the messaging service within 5 seconds under normal operating conditions.
- **SC-003**: Under normal operating conditions, delivered notifications are expected to reach recipients within 15 seconds, and a delivery outcome is recorded for 100% of intended recipients.
- **SC-004**: 100% of broadcasts require explicit confirmation showing both the message and the intended recipients before any message is sent.
- **SC-005**: In a validation scenario, recipient selection returns zero unintended recipients and includes all matching subscribers for the chosen location/role.
- **SC-006**: A new resident can complete registration, profile setup, and consent in under 3 minutes.
- **SC-007**: A resident can submit a valid emergency report in under 1 minute, and 100% of valid reports are stored as NEW and visible to administrators of the correct jurisdiction.
- **SC-008**: 100% of attempts by a low-level administrator to act outside their barangay are denied.
- **SC-009**: 100% of critical administrative actions are recorded in an audit trail retained for at least one year.
- **SC-010**: Main subscriber portal and administrator dashboard content loads within 3 seconds under normal operating conditions.
- **SC-011**: The system supports at least 1,000 resident records while continuing to meet the response-time targets in simulated testing.

## Assumptions

- The project remains an academic demonstration for a single simulated locality; no real client,
  pilot institution, or paid messaging is required for acceptance.
- SMS is the primary and required notification channel and is demonstrated through a simulated
  messaging environment; live paid delivery is out of scope.
- Residents self-register with representative data and record their own consent; phone-number
  verification by one-time code is out of scope for the initial release.
- Email and Web Push are optional secondary channels and are not required for the initial
  demonstration.
- Administrators use system-managed email-and-password accounts; Google sign-in applies to
  residents only.
- Audit records are retained for one year as a project decision, not a statutory requirement.
- Photos or other media on reports are optional and secondary to text and location.
- The scope is one locality with multiple barangays; expansion to multiple localities is future work.
- Residents have access to a device with internet connectivity and, where available, location
  services; a structured address is accepted when location services are unavailable.
- The primary delivery channel provider exposes delivery statuses that the system can record.
