import {
  AlertStatus,
  Prisma,
  PrismaClient,
  ReportStatus,
  Resident
} from '@prisma/client';
import { AppError } from '../../middleware/error';
import type { Principal } from '../../types/auth';
import { recordAudit } from '../audit/audit.service';
import { parseTargets, type AlertWithTargets } from '../alerts/alert.service';
import type { TargetInput } from '../alerts/recipient.service';
import { assertTransition, type ReportInput } from './report.validation';

async function findReport(prisma: PrismaClient, reportId: string) {
  const report = await prisma.emergencyReport.findUnique({ where: { id: reportId } });
  if (!report) throw new AppError(404, 'Report not found', 'NOT_FOUND');
  return report;
}

function assertReportScope(principal: Principal, report: { barangayId: string }): void {
  if (principal.role === 'LOW_LEVEL' && report.barangayId !== principal.barangayId) {
    throw new AppError(403, 'Report is outside your jurisdiction', 'FORBIDDEN');
  }
}

export async function submitReport(
  prisma: PrismaClient,
  resident: Resident,
  input: ReportInput
) {
  const report = await prisma.emergencyReport.create({
    data: {
      residentId: resident.id,
      barangayId: resident.barangayId,
      category: input.category,
      severity: input.severity,
      description: input.description,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      addressText: input.addressText ?? null,
      status: ReportStatus.NEW,
      history: { create: { toStatus: ReportStatus.NEW } }
    }
  });
  await recordAudit(prisma, {
    actorType: 'RESIDENT',
    actorId: resident.id,
    action: 'REPORT_SUBMITTED',
    entityType: 'EmergencyReport',
    entityId: report.id,
    metadata: { category: report.category, severity: report.severity }
  });
  return report;
}

export async function listReports(
  prisma: PrismaClient,
  principal: Principal,
  status?: ReportStatus
) {
  const where: Prisma.EmergencyReportWhereInput = {};
  if (principal.role === 'LOW_LEVEL') {
    where.barangayId = principal.barangayId ?? '__none__';
  }
  if (status) where.status = status;
  return prisma.emergencyReport.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200
  });
}

export async function getReport(prisma: PrismaClient, principal: Principal, reportId: string) {
  const report = await findReport(prisma, reportId);
  assertReportScope(principal, report);
  return report;
}

export async function updateReportStatus(
  prisma: PrismaClient,
  principal: Principal,
  reportId: string,
  status: ReportStatus
) {
  const report = await findReport(prisma, reportId);
  assertReportScope(principal, report);
  assertTransition(report.status, status);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.reportStatusHistory.create({
      data: {
        reportId,
        fromStatus: report.status,
        toStatus: status,
        changedByAdminId: principal.id
      }
    });
    return tx.emergencyReport.update({
      where: { id: reportId },
      data: { status, reviewedByAdminId: principal.id }
    });
  });

  await recordAudit(prisma, {
    actorType: 'ADMIN',
    actorId: principal.id,
    action: 'REPORT_STATUS_CHANGED',
    entityType: 'EmergencyReport',
    entityId: reportId,
    metadata: { from: report.status, to: status }
  });

  return updated;
}

export async function escalateReport(
  prisma: PrismaClient,
  principal: Principal,
  reportId: string,
  body: Record<string, unknown>
): Promise<AlertWithTargets> {
  const report = await findReport(prisma, reportId);
  assertReportScope(principal, report);
  if (report.escalatedAlertId) {
    throw new AppError(409, 'Report has already been escalated', 'INVALID_STATE');
  }

  const content = String(body.content ?? '').trim();
  if (!content) throw new AppError(400, 'content is required', 'VALIDATION_ERROR');

  const targets: TargetInput[] =
    body.targets !== undefined ? parseTargets(body.targets) : [{ barangayId: report.barangayId }];

  const alert = await prisma.alert.create({
    data: {
      content,
      category: report.category,
      createdByAdminId: principal.id,
      status: AlertStatus.DRAFT,
      targets: {
        create: targets.map((target) => ({
          barangayId: target.barangayId ?? null,
          residentRole: target.residentRole ?? null
        }))
      }
    },
    include: { targets: true }
  });

  await prisma.emergencyReport.update({
    where: { id: reportId },
    data: { escalatedAlertId: alert.id }
  });

  await recordAudit(prisma, {
    actorType: 'ADMIN',
    actorId: principal.id,
    action: 'REPORT_ESCALATED',
    entityType: 'EmergencyReport',
    entityId: reportId,
    metadata: { alertId: alert.id }
  });

  return alert;
}
