import type { PrismaClient } from '@prisma/client';
import {
  countTerminalFailures,
  fanOutFailureNotifications,
  notificationAudienceWhere
} from '../../src/modules/notifications/notification.service';

describe('notification service', () => {
  it('counts only terminal FAILURE deliveries', async () => {
    const count = jest.fn().mockResolvedValue(3);
    const prisma = { deliveryRecord: { count } } as unknown as PrismaClient;

    await expect(countTerminalFailures(prisma, 'alert-1')).resolves.toBe(3);
    expect(count).toHaveBeenCalledWith({
      where: { alertId: 'alert-1', status: 'FAILURE' }
    });
  });

  it('resolves the administrator audience by role, activity, creator, and targets', () => {
    const where = notificationAudienceWhere({
      createdByAdminId: 'creator-1',
      targets: [{ barangayId: 'barangay-a' }, { barangayId: null }]
    });

    expect(where).toEqual({
      isActive: true,
      OR: [
        { role: { in: ['SUPERADMIN', 'HIGH_LEVEL'] } },
        {
          role: 'LOW_LEVEL',
          OR: [{ id: 'creator-1' }, { barangayId: { in: ['barangay-a'] } }]
        }
      ]
    });
  });

  it('upserts one notification per administrator with refreshed failure data', async () => {
    const completedAt = new Date('2026-01-02T03:04:05.000Z');
    const upsert = jest.fn().mockResolvedValue({});
    const prisma = {
      alert: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'alert-1',
          createdByAdminId: 'admin-1',
          targets: [{ barangayId: 'barangay-a' }]
        })
      },
      deliveryRecord: { count: jest.fn().mockResolvedValue(2) },
      administrator: {
        findMany: jest.fn().mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }])
      },
      failureNotification: { upsert }
    } as unknown as PrismaClient;

    await expect(fanOutFailureNotifications(prisma, 'alert-1', completedAt)).resolves.toBe(2);

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenNthCalledWith(1, {
      where: { adminId_alertId: { adminId: 'admin-1', alertId: 'alert-1' } },
      create: {
        adminId: 'admin-1',
        alertId: 'alert-1',
        failureCount: 2,
        completedAt
      },
      update: { failureCount: 2, completedAt }
    });
    expect(upsert).toHaveBeenNthCalledWith(2, {
      where: { adminId_alertId: { adminId: 'admin-2', alertId: 'alert-1' } },
      create: {
        adminId: 'admin-2',
        alertId: 'alert-1',
        failureCount: 2,
        completedAt
      },
      update: { failureCount: 2, completedAt }
    });

    await fanOutFailureNotifications(prisma, 'alert-1', completedAt);
    expect(upsert).toHaveBeenCalledTimes(4);
    expect(upsert.mock.calls[2][0]).toEqual(upsert.mock.calls[0][0]);
  });

  it('does not create rows when no terminal failures exist', async () => {
    const upsert = jest.fn();
    const prisma = {
      deliveryRecord: { count: jest.fn().mockResolvedValue(0) },
      alert: { findUniqueOrThrow: jest.fn() },
      administrator: { findMany: jest.fn() },
      failureNotification: { upsert }
    } as unknown as PrismaClient;

    await expect(fanOutFailureNotifications(prisma, 'alert-1', new Date())).resolves.toBe(0);
    expect(upsert).not.toHaveBeenCalled();
  });
});
