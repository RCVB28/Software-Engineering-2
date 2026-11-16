import { AlertCategory, ReportSeverity, ReportStatus } from '@prisma/client';
import { AppError } from '../../middleware/error';
import { assert, optionalString, parseEnum, requireString } from '../../middleware/validation';

export interface ReportInput {
  category: AlertCategory;
  severity: ReportSeverity;
  description: string;
  latitude?: number | null;
  longitude?: number | null;
  addressText?: string | null;
}

const REPORT_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  [ReportStatus.NEW]: [ReportStatus.ACKNOWLEDGED, ReportStatus.DISMISSED],
  [ReportStatus.ACKNOWLEDGED]: [ReportStatus.RESOLVED, ReportStatus.DISMISSED],
  [ReportStatus.RESOLVED]: [],
  [ReportStatus.DISMISSED]: []
};

function coordinate(value: unknown, field: string, min: number, max: number): number | null {
  if (value === undefined || value === null || value === '') return null;
  assert(typeof value === 'number' && Number.isFinite(value), `${field} must be a number`);
  const num = value as number;
  assert(num >= min && num <= max, `${field} must be between ${min} and ${max}`);
  return num;
}

export function parseReportInput(body: Record<string, unknown>): ReportInput {
  const category = parseEnum(body.category, Object.values(AlertCategory), 'category');
  const severity = parseEnum(body.severity, Object.values(ReportSeverity), 'severity');
  const description = requireString(body.description, 'description', 500);
  const latitude = coordinate(body.latitude, 'latitude', -90, 90);
  const longitude = coordinate(body.longitude, 'longitude', -180, 180);
  const addressText = optionalString(body.addressText, 'addressText', 300);

  const hasCoordinates = latitude !== null && longitude !== null;
  assert(
    (latitude === null) === (longitude === null),
    'latitude and longitude must be provided together'
  );
  assert(hasCoordinates || addressText !== null, 'Provide latitude and longitude or an address');

  return { category, severity, description, latitude, longitude, addressText };
}

export function assertTransition(from: ReportStatus, to: ReportStatus): void {
  if (from === to) {
    throw new AppError(409, `Report is already ${to}`, 'INVALID_STATE');
  }
  if (!REPORT_TRANSITIONS[from].includes(to)) {
    throw new AppError(409, `Cannot transition a report from ${from} to ${to}`, 'INVALID_STATE');
  }
}
