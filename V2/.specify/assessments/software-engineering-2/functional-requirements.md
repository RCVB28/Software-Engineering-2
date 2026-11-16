# Captured Functional Requirements

- **Slug**: software-engineering-2
- **Created**: 2026-11-12
- **Updated**: 2026-11-12 (clarifications incorporated)
- **Status**: Captured for formalization during `/speckit.specify`
- **Note**: Functional requirements are solution-space content and are intentionally kept out of
  `problem.md` (which stays in the problem space).

## FR-1: Submit Local Emergency Report

**As a** Subscriber, **I want to** submit reports about local emergencies **so that**
administrators can be informed about incidents within my area.

**Acceptance Criteria:**

1. Subscribers can access an emergency report submission form.
2. Subscribers can provide the incident description and location.
3. The system validates and stores submitted reports.
4. Authorized administrators can view submitted reports.
5. Administrators can review and update the report status.

**Scope note:** Advanced capabilities — live incident tracking, image verification, and automated
emergency detection — are explicitly out of scope for the initial implementation.

### Report Lifecycle & Status Values

| Status | Meaning |
| --- | --- |
| NEW | Default state on subscriber submission; unread by administrators. |
| ACKNOWLEDGED | Reviewed by an administrator; response or monitoring has begun. |
| RESOLVED | The incident has been handled or cleared. |
| DISMISSED | Marked as a false alarm, spam, or invalid. |

### Administrator Permissions (Report Records)

| Role | Permitted actions |
| --- | --- |
| Low-Level Admin (Barangay Captain) | View, ACKNOWLEDGE, RESOLVE, or DISMISS reports belonging strictly to their assigned barangay/jurisdiction. |
| High-Level Admin (City Mayor / Department Heads) | View, ACKNOWLEDGE, RESOLVE, or DISMISS reports across all barangays/city-wide, and escalate a report into an official system-wide SMS emergency alert. |
| Superadmin (LGU IT / System Administrators) | Full CRUD on all report records via administrative interfaces, including hard deletion and status overrides. Direct database access remains prohibited per the security requirements. |

### Emergency Report Fields

- **Category/Type** (mandatory, dropdown): Fire, Flood, Medical, Security Threat, Power Outage,
  Infrastructure Damage, Other.
- **Severity Level** (mandatory, selector): Low, Medium, High, Critical.
- **Free-text Description** (mandatory, text area, max 500 characters): specific context/details.
- **Location Data** (mandatory): GPS coordinates (latitude/longitude) or a structured text address
  captured during submission.
- **Media Attachment** (optional): photo upload placeholder, included only if scope permits; text
  and location are the core MVP inputs.

### Location Granularity & Subscriber Mapping

- Two-tier hierarchy: City/Municipality → Barangay → optional specific Building/Zone tag.
- **Barangay is the minimum mandatory administrative boundary** for local emergency management and
  filtering.
- During registration or profile management, subscribers select their primary barangay from a
  dropdown and may optionally enter a street/building tag.
- The Subscribers record carries a `barangay_id` plus a building tag; the recipient group selector
  filters subscribers by the selected `barangay_id` (and optionally role) to target only the
  affected population for broadcasting.
