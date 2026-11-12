import type { PrismaClient } from '@prisma/client';

/**
 * Deletes audit entries older than the retention window. Defaults to one year.
 */
export async function purgeAuditEntries(
  prisma: PrismaClient,
  retentionDays = 365
): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await prisma.auditEntry.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return result.count;
}
