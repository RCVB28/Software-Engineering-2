export type AdminRole = 'SUPERADMIN' | 'HIGH_LEVEL' | 'LOW_LEVEL';
export type ResidentRole = 'RESIDENT' | 'STUDENT' | 'TEACHER' | 'EMPLOYEE' | 'OTHER';
export type AlertCategory =
  | 'FIRE'
  | 'FLOOD'
  | 'MEDICAL'
  | 'SECURITY_THREAT'
  | 'POWER_OUTAGE'
  | 'INFRASTRUCTURE_DAMAGE'
  | 'OTHER';
export type ReportSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ReportStatus = 'NEW' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';
export type AlertStatus = 'DRAFT' | 'CONFIRMED' | 'SENDING' | 'COMPLETED';
export type DeliveryStatus = 'SUBMITTED' | 'SUCCESS' | 'FAILURE' | 'DELAYED';
export type ActorType = 'ADMIN' | 'RESIDENT' | 'SYSTEM';

export const ALERT_CATEGORIES: AlertCategory[] = [
  'FIRE',
  'FLOOD',
  'MEDICAL',
  'SECURITY_THREAT',
  'POWER_OUTAGE',
  'INFRASTRUCTURE_DAMAGE',
  'OTHER'
];

export const RESIDENT_ROLES: ResidentRole[] = [
  'RESIDENT',
  'STUDENT',
  'TEACHER',
  'EMPLOYEE',
  'OTHER'
];

export const ADMIN_ROLES: AdminRole[] = ['SUPERADMIN', 'HIGH_LEVEL', 'LOW_LEVEL'];

export const REPORT_SEVERITIES: ReportSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const REPORT_STATUSES: ReportStatus[] = [
  'NEW',
  'ACKNOWLEDGED',
  'RESOLVED',
  'DISMISSED'
];

export function humanize(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export interface UserSummary {
  id: string;
  kind: 'ADMIN' | 'RESIDENT';
  role: string;
  email?: string;
  displayName?: string;
  barangayId?: string | null;
}

export interface AuthToken {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: UserSummary;
}

export interface Barangay {
  id: string;
  name: string;
}

export interface ResidentProfile {
  id: string;
  email: string;
  displayName: string | null;
  role: ResidentRole;
  barangayId: string;
  buildingTag: string | null;
  isActive: boolean;
}

export interface PhoneNumber {
  id: string;
  number: string;
  isPrimary: boolean;
  isVerified: boolean;
}

export interface Consent {
  granted: boolean;
  policyVersion: string;
  recordedAt: string | null;
}

export interface AlertPreference {
  category: AlertCategory;
  optedIn: boolean;
}

export interface AlertTarget {
  barangayId: string | null;
  residentRole: ResidentRole | null;
}

export interface Alert {
  id: string;
  content: string;
  category: AlertCategory;
  status: AlertStatus;
  createdByAdminId: string;
  confirmedAt: string | null;
  targets: AlertTarget[];
  createdAt: string;
  updatedAt: string;
}

export type ResidentDeliveryOutcome = 'SUCCESS' | 'FAILURE' | 'PARTIAL' | 'PENDING';

export interface PageMetadata {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  pageAdjusted: boolean;
}

export interface AlertHistoryFilters {
  page?: number;
  pageSize?: number;
  status?: AlertStatus;
  category?: AlertCategory;
  barangayId?: string;
  from?: string;
  to?: string;
  q?: string;
}

export interface AlertHistoryItem {
  id: string;
  content: string;
  category: AlertCategory;
  status: AlertStatus;
  targets: AlertTarget[];
  createdAt: string;
  confirmedAt: string | null;
  failureCount: number;
}

export interface AlertHistoryPage extends PageMetadata {
  items: AlertHistoryItem[];
  availableBarangays: Barangay[];
}

export interface FailureNotification {
  id: string;
  alertId: string;
  alertCategory: AlertCategory;
  alertContent: string;
  failureCount: number;
  completedAt: string;
  readAt: string | null;
  createdAt: string;
}

export interface FailureNotificationPage {
  items: FailureNotification[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  unreadCount: number;
}

export interface ResidentAlertHistoryItem {
  alertId: string;
  category: AlertCategory;
  content: string;
  sentAt: string;
  outcome: ResidentDeliveryOutcome;
}

export interface ResidentAlertHistoryPage extends PageMetadata {
  items: ResidentAlertHistoryItem[];
}

export interface DeliveryRecord {
  id: string;
  residentId: string;
  phoneNumber: string;
  status: DeliveryStatus;
  attempts: number;
  lastError: string | null;
  updatedAt: string;
}

export interface EmergencyReport {
  id: string;
  residentId: string;
  barangayId: string;
  category: AlertCategory;
  severity: ReportSeverity;
  description: string;
  latitude: number | null;
  longitude: number | null;
  addressText: string | null;
  status: ReportStatus;
  reviewedByAdminId: string | null;
  escalatedAlertId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Administrator {
  id: string;
  email: string;
  role: AdminRole;
  displayName: string | null;
  barangayId: string | null;
  isActive: boolean;
}

export interface AuditEntry {
  id: string;
  actorType: ActorType;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface RecipientPreview {
  count: number;
  recipients: Array<{
    residentId: string;
    displayName: string | null;
    barangayId: string;
    role: ResidentRole;
    phoneNumbers: string[];
  }>;
}

export interface AlertInput {
  content: string;
  category: AlertCategory;
  targets: AlertTarget[];
}

export interface ReportInput {
  category: AlertCategory;
  severity: ReportSeverity;
  description: string;
  latitude?: number | null;
  longitude?: number | null;
  addressText?: string | null;
}
