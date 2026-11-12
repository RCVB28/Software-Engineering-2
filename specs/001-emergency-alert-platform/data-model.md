# Data Model: Localized Emergency Alert & Reporting Platform

**Feature**: `001-emergency-alert-platform` | **Date**: 2026-11-12

Storage: PostgreSQL accessed through Prisma. All timestamps are UTC. Identifiers are UUIDs unless
noted. This document describes logical entities, fields, relationships, validation rules, and state
transitions; the concrete Prisma schema is an implementation artifact.

## Enumerations

- **AdminRole**: `SUPERADMIN` | `HIGH_LEVEL` | `LOW_LEVEL`
- **ResidentRole**: `RESIDENT` | `STUDENT` | `TEACHER` | `EMPLOYEE` | `OTHER`
- **AlertCategory**: `FIRE` | `FLOOD` | `MEDICAL` | `SECURITY_THREAT` | `POWER_OUTAGE` |
  `INFRASTRUCTURE_DAMAGE` | `OTHER`
- **ReportSeverity**: `LOW` | `MEDIUM` | `HIGH` | `CRITICAL`
- **ReportStatus**: `NEW` | `ACKNOWLEDGED` | `RESOLVED` | `DISMISSED`
- **AlertStatus**: `DRAFT` | `CONFIRMED` | `SENDING` | `COMPLETED`
- **DeliveryStatus**: `SUBMITTED` | `SUCCESS` | `FAILURE` | `DELAYED`
- **ActorType**: `ADMIN` | `RESIDENT` | `SYSTEM`

## Entities

### Locality

Represents the single supported locality.

- **id**: UUID, primary key
- **name**: string, required, unique
- **createdAt**, **updatedAt**: timestamps
- Relationships: one Locality → many Barangays.

### Barangay

The minimum mandatory administrative boundary.

- **id**: UUID, primary key
- **localityId**: FK → Locality, required
- **name**: string, required
- **createdAt**, **updatedAt**: timestamps
- Relationships: many Residents; many Administrators (LOW_LEVEL); referenced by alert targets and
  reports.
- Validation: `(localityId, name)` unique.

### Resident

A person who receives alerts and can submit reports.

- **id**: UUID, primary key
- **googleSubject**: string, required, unique (Google account identifier — residents only)
- **email**: string, required, unique
- **displayName**: string, optional
- **role**: ResidentRole, required, default `RESIDENT`
- **barangayId**: FK → Barangay, required
- **buildingTag**: string, optional (building/zone)
- **isActive**: boolean, default `true`
- **createdAt**, **updatedAt**: timestamps
- Relationships: many PhoneNumbers, one Consent (current), many AlertPreferences, many
  EmergencyReports, many DeliveryRecords.
- Validation: email format; `barangayId` must exist.

### PhoneNumber

A contact number linked to a resident.

- **id**: UUID, primary key
- **residentId**: FK → Resident, required
- **number**: string, required (E.164 normalized)
- **isPrimary**: boolean, default `false`
- **isVerified**: boolean, default `false` (OTP verification is out of scope; stays false)
- **createdAt**: timestamp
- Validation: one primary per resident (enforced in service); `(residentId, number)` unique.

### Consent

A resident's recorded consent to receive emergency notifications.

- **id**: UUID, primary key
- **residentId**: FK → Resident, required, unique per current record
- **granted**: boolean, required
- **policyVersion**: string, required
- **recordedAt**: timestamp
- Validation: a resident must have granted consent before any delivery is attempted. Historical
  consent versions may be retained for audit.

### AlertPreference

A per-category opt-in/opt-out choice.

- **id**: UUID, primary key
- **residentId**: FK → Resident, required
- **category**: AlertCategory, required
- **optedIn**: boolean, required, default `true`
- Validation: `(residentId, category)` unique. Absence of a record means opted in by default.

### Administrator

A system-managed administrative account.

- **id**: UUID, primary key
- **email**: string, required, unique
- **passwordHash**: string, required (bcrypt)
- **role**: AdminRole, required
- **barangayId**: FK → Barangay, nullable; **required when role = LOW_LEVEL**, must be null for
  SUPERADMIN (HIGH_LEVEL may be null = whole locality)
- **displayName**: string, optional
- **isActive**: boolean, default `true`
- **createdAt**, **updatedAt**: timestamps
- Relationships: creates Alerts; reviews EmergencyReports; writes AuditEntries.
- Validation: role/barangay consistency; email format; password never stored in plaintext.

### Alert

An emergency announcement.

- **id**: UUID, primary key
- **content**: string, required (message text)
- **category**: AlertCategory, required
- **createdByAdminId**: FK → Administrator, required
- **status**: AlertStatus, required, default `DRAFT`
- **confirmedAt**: timestamp, nullable
- **createdAt**, **updatedAt**: timestamps
- Relationships: one Alert → many AlertTargets; one Alert → many DeliveryRecords; optional origin
  report (escalation).
- Validation: content non-empty; cannot confirm without at least one target and at least one
  eligible recipient; confirmation requires explicit admin action.

### AlertTarget

The audience definition for an alert (allows one or more barangays and/or a role).

- **id**: UUID, primary key
- **alertId**: FK → Alert, required
- **barangayId**: FK → Barangay, nullable (null = all barangays in the locality)
- **residentRole**: ResidentRole, nullable (null = all roles)
- Validation: at least one of `barangayId` or `residentRole` must be set; a combined target means
  AND (matching both).

### DeliveryRecord

The outcome of notifying one recipient's phone number for one alert.

- **id**: UUID, primary key
- **alertId**: FK → Alert, required
- **residentId**: FK → Resident, required
- **phoneNumber**: string, required (snapshot of the number used)
- **status**: DeliveryStatus, required, default `SUBMITTED`
- **attempts**: integer, required, default `1`
- **idempotencyKey**: string, required, unique (prevents duplicate sends on retry)
- **providerMessageId**: string, optional
- **lastError**: string, optional
- **createdAt**, **updatedAt**: timestamps
- Validation: one record per (alertId, residentId, phoneNumber).

### EmergencyReport

A resident-submitted incident.

- **id**: UUID, primary key
- **residentId**: FK → Resident, required
- **barangayId**: FK → Barangay, required (derived from resident at submission, stored for scoping)
- **category**: AlertCategory-like `ReportCategory` (same value set), required
- **severity**: ReportSeverity, required
- **description**: string, required, max 500 characters
- **latitude**: decimal, nullable
- **longitude**: decimal, nullable
- **addressText**: string, nullable
- **status**: ReportStatus, required, default `NEW`
- **reviewedByAdminId**: FK → Administrator, nullable
- **escalatedAlertId**: FK → Alert, nullable
- **createdAt**, **updatedAt**: timestamps
- Validation: description ≤500; category and severity valid; at least one of (latitude+longitude) or
  `addressText` required; media attachment (if added) optional.
- Relationships: many ReportStatusHistory entries; optional escalation Alert.

### ReportStatusHistory

Audit trail for report status changes.

- **id**: UUID, primary key
- **reportId**: FK → EmergencyReport, required
- **fromStatus**: ReportStatus, nullable (null for initial NEW)
- **toStatus**: ReportStatus, required
- **changedByAdminId**: FK → Administrator, nullable (null for system transitions)
- **changedAt**: timestamp, required

### AuditEntry

Append-only record of critical administrative actions.

- **id**: UUID, primary key
- **actorType**: ActorType, required
- **actorId**: UUID, nullable (null for SYSTEM)
- **action**: string, required (e.g., `ADMIN_CREATED`, `ROLE_CHANGED`, `ALERT_CREATED`,
  `ALERT_BROADCAST`, `REPORT_STATUS_CHANGED`)
- **entityType**: string, required
- **entityId**: UUID, nullable
- **metadata**: JSON, optional (summary of before/after without secrets)
- **createdAt**: timestamp, required
- Retention: retained one year; a scheduled cleanup deletes entries older than 365 days.

## Relationships (summary)

- Locality 1—* Barangay
- Barangay 1—* Resident; Barangay 1—* Administrator (LOW_LEVEL)
- Resident 1—* PhoneNumber; Resident 1—1 Consent; Resident 1—* AlertPreference
- Resident 1—* EmergencyReport
- Administrator 1—* Alert (createdBy); Administrator 1—* EmergencyReport (reviewedBy)
- Alert 1—* AlertTarget; Alert 1—* DeliveryRecord
- Resident 1—* DeliveryRecord; PhoneNumber n—1 DeliveryRecord via snapshot
- EmergencyReport 1—* ReportStatusHistory; EmergencyReport 0..1—1 Alert (escalation)
- Administrator/Resident 1—* AuditEntry (via actorType/actorId)

## Recipient eligibility rule

A resident is an intended recipient of an alert when ALL of the following hold:

1. Resident is active.
2. Resident has a recorded granted Consent.
3. Resident matches every non-null AlertTarget constraint (barangay and/or role).
4. Resident has not opted out of the alert's category.
5. Resident has at least one active phone number.

The system computes the eligible set at confirmation time and re-displays it before sending.

## State transitions

### EmergencyReport

```text
NEW ──acknowledge──▶ ACKNOWLEDGED ──resolve──▶ RESOLVED
 │                         │
 │                         └──dismiss──────▶ DISMISSED
 └──dismiss───────────────────────────────▶ DISMISSED
```

- A RESOLVED or DISMISSED report is terminal for normal triage.
- Escalation to an alert is available to HIGH_LEVEL admins and does not change report status; it
  sets `escalatedAlertId` and creates a DRAFT alert.

### Alert

```text
DRAFT ──confirm (explicit, with recipients)──▶ CONFIRMED ──dispatch──▶ SENDING ──all attempted──▶ COMPLETED
```

- No message is sent while DRAFT.
- CONFIRMED requires at least one AlertTarget and a non-empty eligible recipient set.
- SENDING/COMPLETED reflect provider progress; per-recipient outcomes live in DeliveryRecord.

### DeliveryRecord

```text
SUBMITTED ──provider success──▶ SUCCESS
SUBMITTED ──provider failure──▶ FAILURE ──retry (bounded)──▶ SUBMITTED
SUBMITTED ──timeout / no timely outcome──▶ DELAYED ──late outcome──▶ SUCCESS | FAILURE
```

- `idempotencyKey` is checked before each send to prevent duplicates.

## Validation rules (cross-cutting)

- All requests validated server-side; unknown fields rejected on writes.
- Report description ≤500 characters.
- Enums restricted to the defined value sets.
- LOW_LEVEL administrators must have a `barangayId`; data access is scoped to it.
- Residents may only read/update their own profile, phones, preferences, and reports.
- Personal data is deleted or anonymized when a resident account is removed, except where retention
  is required for audit.
