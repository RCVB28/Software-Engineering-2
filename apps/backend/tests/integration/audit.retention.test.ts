import { ActorType } from '@prisma/client';
import { runAuditRetention } from '../../src/modules/audit/retention.job';
import { describeDb, prisma, resetDatabase } from '../helpers/db';

const DAY_MS = 24 * 60 * 60 * 1000;

describeDb('audit retention integration', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  async function seedEntry(label: string, createdAt: Date) {
    return prisma.auditEntry.create({
      data: {
        actorType: ActorType.SYSTEM,
        action: label,
        entityType: 'RetentionFixture',
        createdAt
      }
    });
  }

  it('removes expired entries, retains the 365-day boundary, and persists runs', async () => {
    const now = new Date('2026-11-14T12:00:00.000Z');
    const expired = await seedEntry('expired', new Date(now.getTime() - 366 * DAY_MS));
    const boundary = await seedEntry('boundary', new Date(now.getTime() - 365 * DAY_MS));
    const fresh = await seedEntry('fresh', new Date(now.getTime() - 364 * DAY_MS));

    const first = await runAuditRetention(prisma, { now });
    const second = await runAuditRetention(prisma, { now });

    expect(first).toMatchObject({ status: 'SUCCESS', removedCount: 1 });
    expect(second).toMatchObject({ status: 'SUCCESS', removedCount: 0 });

    const remaining = await prisma.auditEntry.findMany({ select: { id: true } });
    expect(remaining.map((entry) => entry.id).sort()).toEqual([boundary.id, fresh.id].sort());
    expect(remaining.find((entry) => entry.id === expired.id)).toBeUndefined();

    const runs = await prisma.auditRetentionRun.findMany({
      orderBy: { startedAt: 'asc' }
    });
    expect(runs).toHaveLength(2);
    for (const run of runs) {
      expect(run.status).toBe('SUCCESS');
      expect(run.finishedAt).not.toBeNull();
    }
    expect(runs.map((run) => run.removedCount)).toEqual([1, 0]);

    const third = await runAuditRetention(prisma, { now });
    expect(third.removedCount).toBe(0);
    expect(await prisma.auditEntry.count()).toBe(2);
  });
});
