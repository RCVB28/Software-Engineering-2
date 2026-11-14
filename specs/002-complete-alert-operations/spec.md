# Feature Specification: Alert Operations Completion

**Feature Branch**: `002-complete-alert-operations`

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "Close the highest-value gaps in the emergency alert platform: let administrators reopen and edit saved drafts, notify administrators of failed alert deliveries, provide a paged and filterable alert history for administrators and residents, and make the one-year audit retention policy run automatically."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reopen and Edit a Saved Draft (Priority: P1)

An administrator saves an alert as a draft, leaves the console, and later reopens that draft from the alert history. They can change the message, category, and recipient targets, save the changes, preview recipients, and send the alert. Once an alert has been sent, it can no longer be edited.

**Why this priority**: A draft that cannot be resumed or corrected after leaving the page is not a usable draft. This closes the basic create-save-return-send workflow.

**Independent Test**: Save a draft, navigate away, reopen it from history, change every editable field, save, reopen again, and verify the changes persisted. Then send it and verify editing is refused.

**Acceptance Scenarios**:

1. **Given** a saved draft, **When** an authorized administrator reopens it, **Then** the saved message, category, and targets are shown exactly as last saved.
2. **Given** a reopened draft, **When** the administrator changes fields and saves, **Then** the updated values persist and are shown on the next visit.
3. **Given** a reopened draft, **When** the administrator previews recipients, **Then** the preview reflects the current saved draft.
4. **Given** a draft that is still unsent, **When** an authorized administrator sends it, **Then** the alert is broadcast using the last saved values.
5. **Given** an alert that is already sending or completed, **When** anyone attempts to edit or resend it, **Then** the attempt is rejected and the alert remains unchanged.
6. **Given** a draft being edited, **When** another administrator sends it first, **Then** the save is rejected with an explanation that the alert is no longer a draft.

---

### User Story 2 - See Failed Deliveries Without Opening Every Alert (Priority: P1)

After a broadcast finishes with one or more failed deliveries, administrators receive an in-app notification identifying the alert, the number of failed deliveries, and when it happened. They can open the alert's delivery results from the notification and acknowledge it when handled. Repeated processing of the same alert does not create duplicate notifications.

**Why this priority**: Delivery failures are currently invisible unless an administrator opens each alert. Administrators must learn about failed emergency messages promptly.

**Independent Test**: Broadcast to several recipients with one permanent failure and verify exactly one notification appears for administrators in the affected jurisdiction, survives a page reload, and disappears from the unread count after acknowledgement.

**Acceptance Scenarios**:

1. **Given** a confirmed alert where every delivery succeeds, **When** processing completes, **Then** no failure notification is created.
2. **Given** a confirmed alert with at least one terminal delivery failure, **When** processing completes, **Then** one notification per eligible administrator is created with the alert, failure count, and completion time.
3. **Given** a delivery that fails once and then succeeds on retry, **When** processing completes, **Then** no failure notification is created.
4. **Given** the same alert is processed again (for example after an interrupted retry), **When** it completes, **Then** no additional notification is created.
5. **Given** a low-level administrator, **When** failures occur on an alert outside their barangay, **Then** they receive no notification for that alert.
6. **Given** an unread failure notification, **When** the administrator acknowledges it, **Then** the unread count decreases and the notification remains available in history.
7. **Given** a notification, **When** the administrator selects it, **Then** they are taken to that alert's delivery results.

---

### User Story 3 - Browse and Filter Administrative Alert History (Priority: P2)

An administrator opens a complete alert history instead of only a short recent list. They can page through alerts and filter by status, category, barangay, or date range, and search message text. Drafts can be opened for editing; completed alerts can be opened for delivery results.

**Why this priority**: Operational history is needed to find past broadcasts, resume drafts, and investigate failures. The current short list does not scale.

**Independent Test**: With more than one page of alerts, apply each filter and verify only matching alerts appear, paging preserves filters, drafts open for editing, and alerts outside the administrator's jurisdiction are never listed.

**Acceptance Scenarios**:

1. **Given** many alerts, **When** an administrator opens history, **Then** alerts appear newest first with message, category, status, targets, creation time, send time when available, and failure count.
2. **Given** any combination of status, category, barangay, and date-range filters plus optional message search, **When** applied, **Then** only matching alerts are listed and the result count is shown.
3. **Given** filtered results spanning multiple pages, **When** the administrator moves to another page, **Then** the filters remain applied and page contents do not overlap or skip alerts.
4. **Given** a low-level administrator, **When** they view history, **Then** only alerts within their barangay are visible and filter options that would reveal other barangays are unavailable.
5. **Given** a draft in history, **When** selected, **Then** it opens for editing or sending.
6. **Given** a completed alert in history, **When** selected, **Then** its delivery results are available.
7. **Given** filters that match nothing, **When** applied, **Then** a clear empty state is shown and filters can be reset.

---

### User Story 4 - Review Personal Alert History (Priority: P2)

A resident opens their personal history and sees the emergency alerts that were directed to them, newest first, with category, message, when it was sent, and whether it reached their phone. They can page through older entries but can never see another resident's history.

**Why this priority**: The subscriber portal promises alert history and settings. Residents currently see announcements and their own reports, but not their notification history.

**Independent Test**: Deliver alerts to two residents with different outcomes and verify each resident sees only their own entries, correctly ordered and paged.

**Acceptance Scenarios**:

1. **Given** a resident with past alerts, **When** they open personal history, **Then** they see only alerts directed to them, newest first, with category, message, send time, and delivery outcome.
2. **Given** more entries than fit on one page, **When** the resident pages forward and back, **Then** entries remain unique and correctly ordered.
3. **Given** a resident with no history, **When** they open the page, **Then** a clear empty state is shown.
4. **Given** any resident, **When** they request another resident's history, **Then** access is denied and no personal data is revealed.
5. **Given** delivery is still in progress, **When** the resident views history, **Then** the entry shows a pending outcome and later reflects the final result.

---

### User Story 5 - Automatic One-Year Audit Retention (Priority: P3)

The platform removes audit entries older than one year automatically, without an administrator running a command. Each run is safe to repeat, does not interrupt normal use, and records its outcome for operators. Entries within the retention window are never removed.

**Why this priority**: Retention is a compliance commitment. The cleanup logic exists but never runs, so the policy is currently unmet.

**Independent Test**: Seed entries older and newer than one year, run the scheduled cleanup, and verify only expired entries are removed. Run it again and verify no further deletions or errors.

**Acceptance Scenarios**:

1. **Given** an audit entry older than 365 days, **When** the scheduled cleanup runs, **Then** that entry is removed.
2. **Given** an audit entry exactly 365 days old or newer, **When** the cleanup runs, **Then** the entry is retained.
3. **Given** the cleanup runs at least once per day without administrative action, **When** normal activity continues, **Then** users experience no errors or noticeable delay.
4. **Given** a cleanup run is interrupted or fails, **When** the next scheduled run occurs, **Then** expired entries are still removed and the failure is recorded for operators.
5. **Given** a cleanup run, **When** it finishes, **Then** the number of removed entries and the outcome are recorded for operators.

---

### Edge Cases

- A draft is edited while another administrator confirms it: the later save is rejected because the alert is no longer editable.
- Two administrators edit the same draft: the last successful save wins, and the saved values are shown on the next visit.
- A draft is saved with targets that later have no eligible recipients: sending is blocked with a clear explanation and the draft remains available for correction.
- Message length or target validity changes between saves: invalid input is rejected before the draft is updated.
- An alert has failures across multiple barangays: each administrator sees only the failure count for alerts they are allowed to access.
- A failure notification exists for an alert later hidden by a jurisdiction change: the notification is no longer actionable by that administrator.
- History filters produce a page beyond the last page: the user is returned to the last valid page with an explanation.
- Date-range filters use different time zones: filtering follows the locality's displayed time zone.
- A resident's phone delivery is retried: history shows only the final outcome, not intermediate attempts.
- Retention runs during heavy activity: the cleanup must not block or fail user requests.
- Clock changes or a delayed scheduler: running cleanup twice in one day is harmless.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Authorized administrators MUST be able to reopen any saved draft within their jurisdiction from alert history or the drafts list.
- **FR-002**: The system MUST display the last saved message, category, and targets when a draft is reopened.
- **FR-003**: Authorized administrators MUST be able to update a draft's message, category, and targets and persist those changes.
- **FR-004**: The system MUST revalidate updated drafts against the same content, target, and jurisdiction rules used when creating them.
- **FR-005**: Only alerts still in draft state MUST be editable or sendable; alerts in any other state MUST be immutable.
- **FR-006**: A save or send attempt on an alert that is no longer a draft MUST fail with a clear explanation and MUST NOT alter the alert.
- **FR-007**: Sending a reopened draft MUST use the most recently saved values and MUST still require explicit confirmation.
- **FR-008**: The system MUST create an in-app failure notification when an alert completes with at least one terminal delivery failure.
- **FR-009**: Each failure notification MUST identify the alert, its category, the number of failed deliveries, and the completion time.
- **FR-010**: Failure notifications MUST be created only for administrators who are authorized to view the affected alert.
- **FR-011**: The system MUST create at most one failure notification per alert per administrator, regardless of retries or repeated processing.
- **FR-012**: Deliveries that ultimately succeed after retries MUST NOT produce a failure notification.
- **FR-013**: Administrators MUST be able to see an unread failure-notification count, open a notification's alert delivery results, and acknowledge notifications.
- **FR-014**: Acknowledging a notification MUST remove it from the unread count while keeping it available in notification history.
- **FR-015**: Administrators MUST be able to view a complete alert history ordered newest first, showing message summary, category, status, targets, creation time, send time when available, and failed-delivery count.
- **FR-016**: Alert history MUST support filtering by status, category, barangay, and date range, plus optional message-text search, in any combination.
- **FR-017**: Alert history MUST be paginated with a stable order; moving between pages MUST preserve active filters and MUST NOT duplicate or skip alerts.
- **FR-018**: Alert history results, filters, and filter options MUST respect administrator jurisdiction and MUST NOT reveal alerts outside it.
- **FR-019**: Drafts in alert history MUST lead to the draft-editing view; completed alerts MUST lead to delivery results.
- **FR-020**: Residents MUST be able to view a personal alert history containing only alerts directed to them, newest first, with category, message, send time, and final delivery outcome.
- **FR-021**: Resident personal history MUST be paginated with a stable order and MUST show a pending outcome while delivery is in progress.
- **FR-022**: The system MUST prevent any resident from reading another resident's history or personal delivery data.
- **FR-023**: The system MUST automatically remove audit entries older than 365 days at least once every 24 hours without administrative action.
- **FR-024**: Audit entries exactly 365 days old or newer MUST be retained.
- **FR-025**: Audit retention MUST be idempotent and retry-safe; overlapping or repeated runs MUST NOT remove unexpired entries or produce duplicate side effects.
- **FR-026**: Audit retention failures MUST NOT interrupt user-facing activity, and the next scheduled run MUST retry expired-entry removal.
- **FR-027**: The system MUST record each retention run's outcome, including removed-entry count and failure reason when applicable, for operators.
- **FR-028**: All new history, filter, pagination, notification, and draft-editing inputs MUST be validated and MUST return user-friendly errors.

### Key Entities

- **Alert Draft**: An unsent alert whose message, category, and targets can be revised by an authorized administrator until it is sent.
- **Delivery Outcome**: The final result of attempting to notify one recipient, including success, terminal failure, and the associated alert and recipient.
- **Failure Notification**: An administrator-specific notice that an alert completed with failed deliveries, including unread/acknowledged state and a reference to the alert.
- **Alert History Entry**: A summary view of an alert used for browsing, filtering, and paging, including its status, targets, timestamps, and failure count.
- **Resident Notification History Entry**: A resident-specific view of an alert directed to that resident and the final outcome of their delivery.
- **Audit Entry**: A recorded administrative or security action with a timestamp, subject to the one-year retention rule.
- **Retention Run**: A record of one automatic cleanup attempt, including when it ran, how many entries were removed, and whether it succeeded.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator can reopen a saved draft, change every editable field, save, and see the changes after a reload in under 60 seconds.
- **SC-002**: 100% of alerts that finish with terminal delivery failures produce exactly one failure notification for every authorized administrator, with zero duplicates across retries.
- **SC-003**: An administrator can identify which alerts had failed deliveries and reach the affected delivery results within two actions from the admin home.
- **SC-004**: Alert history returns the first page in under 2 seconds for a locality with 10,000 alerts, and every filter combination returns results in under 2 seconds.
- **SC-005**: Paging through filtered alert history never repeats or omits an alert across at least 10 consecutive pages.
- **SC-006**: 100% of residents see only their own notification history; cross-resident access attempts are denied in 100% of tests.
- **SC-007**: Every audit entry older than 365 days is removed within 24 hours, and 100% of entries within the retention window are retained across repeated runs.
- **SC-008**: Existing broadcast, consent, and reporting workflows continue to pass their automated tests with no regression.
- **SC-009**: 90% of administrators in usability checks locate a failed broadcast without opening individual alerts one by one.

## Assumptions

- In-app notifications are sufficient for informing administrators; email and SMS alerts to administrators are out of scope.
- A failure notification is created only for terminal delivery failures, not for temporary retries that later succeed.
- The 365-day retention period matches the existing audit policy and is not configurable by end users.
- Draft editing is limited to one locality's existing jurisdiction rules; last successful save wins when administrators edit concurrently.
- Automated cleanup runs at least daily; the exact time is an operational choice and does not need administrator input.
- Timestamps are stored consistently and displayed in the locality's local time.
- History page sizes use a sensible default and a bounded maximum, with paging controls.
- Residents see only alerts for which they were an intended recipient; they do not see alerts targeting other areas.
- Existing alert content, targeting, consent, and confirmation rules remain unchanged.

## Out of Scope

- CI pipeline verification, browser end-to-end test coverage, live Twilio delivery, deployment artifacts, and general security hardening (rate limiting, password reset, token storage) remain separate follow-up work.
- Report media attachments.
- Phone-number one-time-code verification, live paid SMS delivery, and multi-locality support.
- Deleting or duplicating drafts, and editing alerts after they have been sent.
- Out-of-app channels for failure notifications.
