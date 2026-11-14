import type { PrismaClient } from '@prisma/client';
import { purgeAuditEntries, runAuditRetention } from '../../src/modules/audit/retention.job';

function retentionPrisma(options: { count?: number; fail?: boolean } = {}) {
  const create = jest.fn().mockResolvedValue({ id: 'run-1' });
  const update = jest.fn().mockResolvedValue({});
  const deleteMany = options.fail
    ? jest.fn().mockRejectedValue(new Error('database offline'))
    : jest.fn().mockResolvedValue({ count: options.count ?? 0 });

  return {
    prisma: {
      auditRetentionRun: { create, update },
      auditEntry: { deleteMany }
    } as unknown as PrismaClient,
    create,
    update,
    deleteMany
  };
}

describe('audit retention', () => {
  it('deletes entries older than the retention window with a strict cutoff', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 4 });
    const prisma = { auditEntry: { deleteMany } } as unknown as PrismaClient;
    const now = new Date('2026-06-01T00:00:00.000Z');

    const deleted = await purgeAuditEntries(prisma, 30, now);

    expect(deleted).toBe(4);
    const where = deleteMany.mock.calls[0][0].where;
    expect(where.createdAt.lt).toEqual(new Date('2026-05-02T00:00:00.000Z'));
    expect(where.createdAt.lte).toBeUndefined();
  });

  it('persists a RUNNING row followed by SUCCESS with the removed count', async () => {
    const { prisma, create, update, deleteMany } = retentionPrisma({ count: 3 });
    const now = new Date('2026-11-14T10:00:00.000Z');

    const result = await runAuditRetention(prisma, { now, retentionDays: 365 });

    expect(create).toHaveBeenCalledWith({
      data: { status: 'RUNNING', startedAt: now }
    });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date('2025-11-14T10:00:00.000Z') } }
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: expect.objectContaining({
        status: 'SUCCESS',
        removedCount: 3,
        finishedAt: expect.any(Date)
      })
    });
    expect(result).toMatchObject({ status: 'SUCCESS', removedCount: 3, runId: 'run-1' });
  });

  it('is idempotent when repeated purges find nothing left to delete', async () => {
    const { prisma, deleteMany } = retentionPrisma({ count: 2 });
    const now = new Date('2026-11-14T10:00:00.000Z');

    const first = await runAuditRetention(prisma, { now });
    deleteMany.mockResolvedValueOnce({ count: 0 });
    const second = await runAuditRetention(prisma, { now });

    expect(first.removedCount).toBe(2);
    expect(second.removedCount).toBe(0);
    expect(deleteMany).toHaveBeenCalledTimes(2);
  });

  it('persists FAILED with an error summary and does not rethrow', async () => {
    const { prisma, update } = retentionPrisma({ fail: true });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const now = new Date('2026-11-14T10:00:00.000Z');

    const result = await runAuditRetention(prisma, { now });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        error: 'database offline',
        finishedAt: expect.any(Date)
      })
    });
    expect(result).toMatchObject({
      status: 'FAILED',
      removedCount: 0,
      error: 'database offline'
    });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
