import type { PrismaClient } from '@prisma/client';
import { purgeAuditEntries } from '../../src/modules/audit/retention.job';

describe('audit retention', () => {
  it('deletes entries older than the retention window', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 4 });
    const prisma = { auditEntry: { deleteMany } } as unknown as PrismaClient;

    const deleted = await purgeAuditEntries(prisma, 30);

    expect(deleted).toBe(4);
    const where = deleteMany.mock.calls[0][0].where;
    const cutoff = where.createdAt.lt as Date;
    const ageDays = (Date.now() - cutoff.getTime()) / (24 * 60 * 60 * 1000);
    expect(ageDays).toBeGreaterThan(29.9);
    expect(ageDays).toBeLessThan(30.1);
  });
});
