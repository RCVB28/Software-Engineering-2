import type { PrismaClient } from '@prisma/client';

export const DEFAULT_RETENTION_DAYS = 365;
const MAX_ERROR_LENGTH = 500;

/**
 * Deletes audit entries older than the retention window. Defaults to one year.
 */
export async function purgeAuditEntries(
  prisma: PrismaClient,
  retentionDays = DEFAULT_RETENTION_DAYS,
  now = new Date()
): Promise<number> {
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await prisma.auditEntry.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return result.count;
}

export interface AuditRetentionOptions {
  now?: Date;
  retentionDays?: number;
}

export interface AuditRetentionResult {
  runId: string;
  status: 'SUCCESS' | 'FAILED';
  removedCount: number;
  error: string | null;
}

function errorSummary(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, MAX_ERROR_LENGTH);
}

/**
 * Runs retention once and persists the outcome. Failures are recorded and logged, never rethrown,
 * so the caller or scheduler can continue operating.
 */
export async function runAuditRetention(
  prisma: PrismaClient,
  options: AuditRetentionOptions = {}
): Promise<AuditRetentionResult> {
  const now = options.now ?? new Date();
  const retentionDays = options.retentionDays ?? DEFAULT_RETENTION_DAYS;
  const run = await prisma.auditRetentionRun.create({
    data: { status: 'RUNNING', startedAt: now }
  });

  try {
    const removedCount = await purgeAuditEntries(prisma, retentionDays, now);
    await prisma.auditRetentionRun.update({
      where: { id: run.id },
      data: { status: 'SUCCESS', finishedAt: new Date(), removedCount }
    });
    return { runId: run.id, status: 'SUCCESS', removedCount, error: null };
  } catch (error) {
    const errorMessage = errorSummary(error);
    try {
      await prisma.auditRetentionRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', finishedAt: new Date(), error: errorMessage }
      });
    } catch (updateError) {
      // eslint-disable-next-line no-console
      console.error('Failed to record audit retention failure', updateError);
    }
    // eslint-disable-next-line no-console
    console.error('Audit retention failed', error);
    return { runId: run.id, status: 'FAILED', removedCount: 0, error: errorMessage };
  }
}
