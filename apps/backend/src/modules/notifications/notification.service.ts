import {
  AdminRole,
  DeliveryStatus,
  Prisma,
  PrismaClient
} from '@prisma/client';
import { AppError } from '../../middleware/error';
import { resolvePagination } from '../../middleware/query';

interface NotificationAlert {
  createdByAdminId: string;
  targets: Array<{ barangayId: string | null }>;
}

interface NotificationRecord {
  id: string;
  alertId: string;
  failureCount: number;
  completedAt: Date;
  readAt: Date | null;
  createdAt: Date;
  alert: { category: string; content: string };
}

export interface NotificationFilters {
  page: number;
  pageSize: number;
  unreadOnly: boolean;
}

function mapNotification(notification: NotificationRecord) {
  return {
    id: notification.id,
    alertId: notification.alertId,
    alertCategory: notification.alert.category,
    alertContent: notification.alert.content,
    failureCount: notification.failureCount,
    completedAt: notification.completedAt,
    readAt: notification.readAt,
    createdAt: notification.createdAt
  };
}

export function notificationAudienceWhere(alert: NotificationAlert): Prisma.AdministratorWhereInput {
  const targetBarangayIds = [
    ...new Set(
      alert.targets
        .map((target) => target.barangayId)
        .filter((barangayId): barangayId is string => Boolean(barangayId))
    )
  ];

  return {
    isActive: true,
    OR: [
      { role: { in: [AdminRole.SUPERADMIN, AdminRole.HIGH_LEVEL] } },
      {
        role: AdminRole.LOW_LEVEL,
        OR: [
          { id: alert.createdByAdminId },
          ...(targetBarangayIds.length > 0
            ? [{ barangayId: { in: targetBarangayIds } }]
            : [])
        ]
      }
    ]
  };
}

export async function countTerminalFailures(
  prisma: Pick<PrismaClient, 'deliveryRecord'>,
  alertId: string
): Promise<number> {
  return prisma.deliveryRecord.count({
    where: { alertId, status: DeliveryStatus.FAILURE }
  });
}

export async function fanOutFailureNotifications(
  prisma: PrismaClient,
  alertId: string,
  completedAt: Date
): Promise<number> {
  const failureCount = await countTerminalFailures(prisma, alertId);
  if (failureCount === 0) return 0;

  const alert = await prisma.alert.findUniqueOrThrow({
    where: { id: alertId },
    include: { targets: true }
  });
  const audience = await prisma.administrator.findMany({
    where: notificationAudienceWhere(alert),
    select: { id: true }
  });

  for (const admin of audience) {
    await prisma.failureNotification.upsert({
      where: { adminId_alertId: { adminId: admin.id, alertId } },
      create: {
        adminId: admin.id,
        alertId,
        failureCount,
        completedAt
      },
      update: { failureCount, completedAt }
    });
  }

  return audience.length;
}

export async function listFailureNotifications(
  prisma: PrismaClient,
  adminId: string,
  filters: NotificationFilters
) {
  const where: Prisma.FailureNotificationWhereInput = {
    adminId,
    ...(filters.unreadOnly ? { readAt: null } : {})
  };

  const [total, unreadCount] = await Promise.all([
    prisma.failureNotification.count({ where }),
    prisma.failureNotification.count({ where: { adminId, readAt: null } })
  ]);
  const pagination = resolvePagination(filters.page, filters.pageSize, total);
  const items = await prisma.failureNotification.findMany({
    where,
    include: { alert: { select: { category: true, content: true } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: (pagination.page - 1) * pagination.pageSize,
    take: pagination.pageSize
  });

  return {
    ...pagination,
    items: items.map(mapNotification),
    unreadCount
  };
}

export async function acknowledgeNotification(
  prisma: PrismaClient,
  adminId: string,
  notificationId: string
) {
  const notification = await prisma.failureNotification.findFirst({
    where: { id: notificationId, adminId },
    include: { alert: { select: { category: true, content: true } } }
  });
  if (!notification) {
    throw new AppError(404, 'Notification not found', 'NOT_FOUND');
  }

  if (notification.readAt) return mapNotification(notification);

  const acknowledged = await prisma.failureNotification.update({
    where: { id: notification.id },
    data: { readAt: new Date() },
    include: { alert: { select: { category: true, content: true } } }
  });
  return mapNotification(acknowledged);
}
