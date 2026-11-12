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
