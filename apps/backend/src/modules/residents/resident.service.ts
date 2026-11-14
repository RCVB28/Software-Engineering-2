import {
  AlertCategory,
  AlertStatus,
  DeliveryStatus,
  Prisma,
  PrismaClient,
  Resident,
  ResidentRole
} from '@prisma/client';
import { AppError } from '../../middleware/error';
import { resolvePagination } from '../../middleware/query';
import { normalizePhone } from '../../middleware/validation';
import { recordAudit } from '../audit/audit.service';

export interface ProfileUpdateInput {
  displayName?: string | null;
  role?: ResidentRole;
  barangayId?: string;
  buildingTag?: string | null;
}

export interface ConsentInput {
  granted: boolean;
  policyVersion: string;
}

export interface PreferenceInput {
  category: AlertCategory;
  optedIn: boolean;
}

function toProfile(resident: Resident) {
  return {
    id: resident.id,
    email: resident.email,
    displayName: resident.displayName,
    role: resident.role,
    barangayId: resident.barangayId,
    buildingTag: resident.buildingTag,
    isActive: resident.isActive,
    createdAt: resident.createdAt,
    updatedAt: resident.updatedAt
  };
}

export async function getProfile(prisma: PrismaClient, residentId: string) {
  const resident = await prisma.resident.findUnique({ where: { id: residentId } });
  if (!resident) throw new AppError(404, 'Resident not found', 'NOT_FOUND');
  return toProfile(resident);
}

export async function updateProfile(
  prisma: PrismaClient,
  residentId: string,
  input: ProfileUpdateInput
) {
  const resident = await prisma.resident.update({
    where: { id: residentId },
    data: {
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.barangayId !== undefined ? { barangayId: input.barangayId } : {}),
      ...(input.buildingTag !== undefined ? { buildingTag: input.buildingTag } : {})
    }
  });
  await recordAudit(prisma, {
    actorType: 'RESIDENT',
    actorId: residentId,
    action: 'PROFILE_UPDATED',
    entityType: 'Resident',
    entityId: residentId
  });
  return toProfile(resident);
}

export async function listPhones(prisma: PrismaClient, residentId: string) {
  return prisma.phoneNumber.findMany({ where: { residentId }, orderBy: { createdAt: 'asc' } });
}

export async function addPhone(
  prisma: PrismaClient,
  residentId: string,
  rawNumber: string,
  isPrimary: boolean
) {
  const number = normalizePhone(rawNumber);
  const existing = await prisma.phoneNumber.findUnique({
    where: { residentId_number: { residentId, number } }
  });
  if (existing) throw new AppError(409, 'Phone number is already linked', 'DUPLICATE');

  const count = await prisma.phoneNumber.count({ where: { residentId } });
  const primary = isPrimary || count === 0;

  const phone = await prisma.$transaction(async (tx) => {
    if (primary) {
      await tx.phoneNumber.updateMany({ where: { residentId }, data: { isPrimary: false } });
    }
    return tx.phoneNumber.create({ data: { residentId, number, isPrimary: primary } });
  });

  await recordAudit(prisma, {
    actorType: 'RESIDENT',
    actorId: residentId,
    action: 'PHONE_LINKED',
    entityType: 'PhoneNumber',
    entityId: phone.id
  });
  return phone;
}

export async function removePhone(prisma: PrismaClient, residentId: string, phoneId: string) {
  const phone = await prisma.phoneNumber.findFirst({ where: { id: phoneId, residentId } });
  if (!phone) throw new AppError(404, 'Phone number not found', 'NOT_FOUND');

  await prisma.$transaction(async (tx) => {
    await tx.phoneNumber.delete({ where: { id: phoneId } });
    if (phone.isPrimary) {
      const next = await tx.phoneNumber.findFirst({
        where: { residentId },
        orderBy: { createdAt: 'asc' }
      });
      if (next) await tx.phoneNumber.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
  });

  await recordAudit(prisma, {
    actorType: 'RESIDENT',
    actorId: residentId,
    action: 'PHONE_UNLINKED',
    entityType: 'PhoneNumber',
    entityId: phoneId
  });
}

export async function getConsent(prisma: PrismaClient, residentId: string) {
  const consent = await prisma.consent.findUnique({ where: { residentId } });
  return (
    consent ?? { granted: false, policyVersion: 'none', recordedAt: null, residentId }
  );
}

export async function setConsent(
  prisma: PrismaClient,
  residentId: string,
  input: ConsentInput
) {
  const consent = await prisma.consent.upsert({
    where: { residentId },
    create: { residentId, granted: input.granted, policyVersion: input.policyVersion },
    update: { granted: input.granted, policyVersion: input.policyVersion, recordedAt: new Date() }
  });
  await recordAudit(prisma, {
    actorType: 'RESIDENT',
    actorId: residentId,
    action: input.granted ? 'CONSENT_GRANTED' : 'CONSENT_REVOKED',
    entityType: 'Consent',
    entityId: consent.id,
    metadata: { policyVersion: input.policyVersion }
  });
  return consent;
}

export async function getPreferences(prisma: PrismaClient, residentId: string) {
  return prisma.alertPreference.findMany({
    where: { residentId },
    orderBy: { category: 'asc' }
  });
}

export async function setPreferences(
  prisma: PrismaClient,
  residentId: string,
  preferences: PreferenceInput[]
) {
  await prisma.$transaction(async (tx) => {
    await tx.alertPreference.deleteMany({ where: { residentId } });
    if (preferences.length > 0) {
      await tx.alertPreference.createMany({
        data: preferences.map((preference) => ({
          residentId,
          category: preference.category,
          optedIn: preference.optedIn
        }))
      });
    }
  });
  await recordAudit(prisma, {
    actorType: 'RESIDENT',
    actorId: residentId,
    action: 'PREFERENCES_UPDATED',
    entityType: 'AlertPreference',
    entityId: residentId,
    metadata: { count: preferences.length }
  });
  return getPreferences(prisma, residentId);
}

export async function listAnnouncements(prisma: PrismaClient, residentId: string) {
  const resident = await prisma.resident.findUnique({ where: { id: residentId } });
  if (!resident) throw new AppError(404, 'Resident not found', 'NOT_FOUND');

  const where: Prisma.AlertWhereInput = {
    status: { in: [AlertStatus.CONFIRMED, AlertStatus.SENDING, AlertStatus.COMPLETED] },
    targets: {
      some: {
        AND: [
          { OR: [{ barangayId: resident.barangayId }, { barangayId: null }] },
          { OR: [{ residentRole: resident.role }, { residentRole: null }] }
        ]
      }
    }
  };

  return prisma.alert.findMany({
    where,
    include: { targets: true },
    orderBy: { createdAt: 'desc' }
  });
}

export type ResidentDeliveryOutcome = 'PENDING' | 'SUCCESS' | 'FAILURE' | 'PARTIAL';

export function aggregateResidentOutcome(
  statuses: DeliveryStatus[]
): ResidentDeliveryOutcome {
  if (statuses.some((status) => status === DeliveryStatus.SUBMITTED || status === DeliveryStatus.DELAYED)) {
    return 'PENDING';
  }
  const successCount = statuses.filter((status) => status === DeliveryStatus.SUCCESS).length;
  if (successCount === statuses.length) return 'SUCCESS';
  if (successCount === 0) return 'FAILURE';
  return 'PARTIAL';
}

export function resolveResidentAlertSentAt(alert: {
  confirmedAt: Date | null;
  createdAt: Date;
}): Date {
  return alert.confirmedAt ?? alert.createdAt;
}

export async function listResidentAlertHistory(
  prisma: PrismaClient,
  residentId: string,
  requestedPage: number,
  pageSize: number
) {
  const where: Prisma.AlertWhereInput = { deliveries: { some: { residentId } } };
  const total = await prisma.alert.count({ where });
  const pagination = resolvePagination(requestedPage, pageSize, total);

  const alerts = await prisma.alert.findMany({
    where,
    select: {
      id: true,
      category: true,
      content: true,
      createdAt: true,
      confirmedAt: true,
      deliveries: {
        where: { residentId },
        select: { status: true }
      }
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: (pagination.page - 1) * pagination.pageSize,
    take: pagination.pageSize
  });

  return {
    ...pagination,
    items: alerts.map((alert) => ({
      alertId: alert.id,
      category: alert.category,
      content: alert.content,
      sentAt: resolveResidentAlertSentAt(alert),
      outcome: aggregateResidentOutcome(alert.deliveries.map((delivery) => delivery.status))
    }))
  };
}

export async function listOwnReports(prisma: PrismaClient, residentId: string) {
  return prisma.emergencyReport.findMany({
    where: { residentId },
    orderBy: { createdAt: 'desc' }
  });
}
