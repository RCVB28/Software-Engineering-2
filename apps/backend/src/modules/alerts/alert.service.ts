import {
  AlertCategory,
  AlertStatus,
  Prisma,
  PrismaClient,
  ResidentRole
} from '@prisma/client';
import { AppError } from '../../middleware/error';
import type { Principal } from '../../types/auth';
import { recordAudit } from '../audit/audit.service';
import { getProvider } from '../messaging';
import { dispatchAlert } from '../messaging/dispatch.service';
import { resolveRecipients, type Recipient, type TargetInput } from './recipient.service';

export type AlertWithTargets = Prisma.AlertGetPayload<{ include: { targets: true } }>;

export interface AlertWriteInput {
  content: string;
  category: AlertCategory;
  targets: TargetInput[];
}

export function parseTargets(value: unknown): TargetInput[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError(400, 'targets must contain at least one item', 'VALIDATION_ERROR');
  }
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new AppError(400, `targets[${index}] must be an object`, 'VALIDATION_ERROR');
    }
    const target = item as Record<string, unknown>;
    const barangayId =
      target.barangayId === undefined || target.barangayId === null
        ? null
        : String(target.barangayId);
    const roleValue = target.residentRole;
    let residentRole: ResidentRole | null = null;
    if (roleValue !== undefined && roleValue !== null) {
      if (!Object.values(ResidentRole).includes(roleValue as ResidentRole)) {
        throw new AppError(400, `targets[${index}].residentRole is invalid`, 'VALIDATION_ERROR');
      }
      residentRole = roleValue as ResidentRole;
    }
    if (!barangayId && !residentRole) {
      throw new AppError(
        400,
        `targets[${index}] must specify barangayId or residentRole`,
        'VALIDATION_ERROR'
      );
    }
    return { barangayId, residentRole };
  });
}

function assertTargetScope(principal: Principal, targets: TargetInput[]): void {
  if (principal.role !== 'LOW_LEVEL') return;
  const own = principal.barangayId;
  if (!own) throw new AppError(403, 'Administrator has no assigned barangay', 'FORBIDDEN');
  const outOfScope = targets.some((target) => target.barangayId && target.barangayId !== own);
  if (outOfScope) {
    throw new AppError(403, 'Cannot target residents outside your barangay', 'FORBIDDEN');
  }
}

async function findScopedAlert(
  prisma: PrismaClient,
  principal: Principal,
  alertId: string
): Promise<AlertWithTargets> {
  const alert = await prisma.alert.findUnique({ where: { id: alertId }, include: { targets: true } });
  if (!alert) throw new AppError(404, 'Alert not found', 'NOT_FOUND');
  if (principal.role === 'LOW_LEVEL') {
    const own = principal.barangayId;
    const inScope = alert.createdByAdminId === principal.id || alert.targets.some((t) => t.barangayId === own);
    if (!inScope) throw new AppError(403, 'Alert is outside your jurisdiction', 'FORBIDDEN');
  }
  return alert;
}

export async function listAlerts(prisma: PrismaClient, principal: Principal) {
  const where: Prisma.AlertWhereInput =
    principal.role === 'LOW_LEVEL'
      ? {
          OR: [
            { createdByAdminId: principal.id },
            { targets: { some: { barangayId: principal.barangayId ?? '__none__' } } }
          ]
        }
      : {};
  return prisma.alert.findMany({
    where,
    include: { targets: true },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getAlert(prisma: PrismaClient, principal: Principal, alertId: string) {
  return findScopedAlert(prisma, principal, alertId);
}

export async function createDraft(
  prisma: PrismaClient,
  principal: Principal,
  input: AlertWriteInput
): Promise<AlertWithTargets> {
  assertTargetScope(principal, input.targets);
  const alert = await prisma.alert.create({
    data: {
      content: input.content,
      category: input.category,
      createdByAdminId: principal.id,
      status: AlertStatus.DRAFT,
      targets: {
        create: input.targets.map((target) => ({
          barangayId: target.barangayId ?? null,
          residentRole: target.residentRole ?? null
        }))
      }
    },
    include: { targets: true }
  });
  await recordAudit(prisma, {
    actorType: 'ADMIN',
    actorId: principal.id,
    action: 'ALERT_DRAFT_CREATED',
    entityType: 'Alert',
    entityId: alert.id
  });
  return alert;
}

export async function updateDraft(
  prisma: PrismaClient,
  principal: Principal,
  alertId: string,
  input: Partial<AlertWriteInput>
): Promise<AlertWithTargets> {
  const existing = await findScopedAlert(prisma, principal, alertId);
  if (existing.status !== AlertStatus.DRAFT) {
    throw new AppError(409, 'Only draft alerts can be modified', 'INVALID_STATE');
  }
  if (input.targets) assertTargetScope(principal, input.targets);

  const alert = await prisma.$transaction(async (tx) => {
    const claimed = await tx.alert.updateMany({
      where: { id: alertId, status: AlertStatus.DRAFT },
      data: {
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        updatedAt: new Date()
      }
    });
    if (claimed.count === 0) {
      throw new AppError(409, 'Only draft alerts can be modified', 'INVALID_STATE');
    }

    if (input.targets) {
      await tx.alertTarget.deleteMany({ where: { alertId } });
      await tx.alertTarget.createMany({
        data: input.targets.map((target) => ({
          alertId,
          barangayId: target.barangayId ?? null,
          residentRole: target.residentRole ?? null
        }))
      });
    }

    return tx.alert.findUniqueOrThrow({ where: { id: alertId }, include: { targets: true } });
  });
  await recordAudit(prisma, {
    actorType: 'ADMIN',
    actorId: principal.id,
    action: 'ALERT_DRAFT_UPDATED',
    entityType: 'Alert',
    entityId: alert.id
  });
  return alert;
}

export async function previewRecipients(
  prisma: PrismaClient,
  principal: Principal,
  alertId: string
): Promise<{ count: number; recipients: Recipient[] }> {
  const alert = await findScopedAlert(prisma, principal, alertId);
  const recipients = await resolveRecipients(prisma, alert.targets, alert.category);
  return { count: recipients.length, recipients };
}

export async function confirmAlert(
  prisma: PrismaClient,
  principal: Principal,
  alertId: string
): Promise<AlertWithTargets> {
  const existing = await findScopedAlert(prisma, principal, alertId);
  if (existing.status !== AlertStatus.DRAFT) {
    throw new AppError(409, 'Alert has already been confirmed', 'INVALID_STATE');
  }

  const claimed = await prisma.$transaction(async (tx) => {
    const claim = await tx.alert.updateMany({
      where: { id: alertId, status: AlertStatus.DRAFT },
      data: { status: AlertStatus.CONFIRMED, confirmedAt: new Date() }
    });
    if (claim.count === 0) {
      throw new AppError(409, 'Alert has already been confirmed', 'INVALID_STATE');
    }

    const alert = await tx.alert.findUniqueOrThrow({
      where: { id: alertId },
      include: { targets: true }
    });
    const recipients = await resolveRecipients(tx, alert.targets, alert.category);
    if (recipients.length === 0) {
      throw new AppError(400, 'No eligible recipients match the alert targets', 'NO_RECIPIENTS');
    }
    return { alert, recipients };
  });

  await recordAudit(prisma, {
    actorType: 'ADMIN',
    actorId: principal.id,
    action: 'ALERT_CONFIRMED',
    entityType: 'Alert',
    entityId: claimed.alert.id,
    metadata: { recipientCount: claimed.recipients.length }
  });

  await dispatchAlert(
    prisma,
    getProvider(),
    alertId,
    claimed.alert.content,
    claimed.recipients.map((recipient) => ({
      residentId: recipient.residentId,
      phoneNumbers: recipient.phoneNumbers
    }))
  );

  return prisma.alert.findUniqueOrThrow({ where: { id: alertId }, include: { targets: true } });
}

export async function listDeliveries(
  prisma: PrismaClient,
  principal: Principal,
  alertId: string
) {
  await findScopedAlert(prisma, principal, alertId);
  return prisma.deliveryRecord.findMany({
    where: { alertId },
    orderBy: { createdAt: 'asc' }
  });
}
