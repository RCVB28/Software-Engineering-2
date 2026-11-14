import {
  AlertCategory,
  AlertStatus,
  DeliveryStatus,
  Prisma,
  PrismaClient
} from '@prisma/client';
import { AppError } from '../../middleware/error';
import {
  parseDateRange,
  parseOptionalEnum,
  parsePage,
  parsePageSize,
  parseSearch,
  resolvePagination
} from '../../middleware/query';
import type { Principal } from '../../types/auth';

export const ALERT_HISTORY_ORDER: Prisma.AlertOrderByWithRelationInput[] = [
  { createdAt: 'desc' },
  { id: 'desc' }
];

export interface AlertHistoryFilters {
  page: number;
  pageSize: number;
  status: AlertStatus | null;
  category: AlertCategory | null;
  barangayId: string | null;
  from: Date | null;
  to: Date | null;
  q: string | null;
}

export function parseAlertHistoryQuery(
  query: Record<string, unknown>,
  principal: Principal
): AlertHistoryFilters {
  const status = parseOptionalEnum(
    query.status,
    Object.values(AlertStatus),
    'status'
  );
  const category = parseOptionalEnum(
    query.category,
    Object.values(AlertCategory),
    'category'
  );

  let barangayId: string | null = null;
  if (query.barangayId !== undefined && query.barangayId !== null && query.barangayId !== '') {
    if (typeof query.barangayId !== 'string') {
      throw new AppError(400, 'barangayId must be a string', 'VALIDATION_ERROR');
    }
    barangayId = query.barangayId;
    if (principal.role === 'LOW_LEVEL' && barangayId !== principal.barangayId) {
      throw new AppError(403, 'Cannot filter by another barangay', 'FORBIDDEN');
    }
  }

  const { from, to } = parseDateRange(query.from, query.to);

  return {
    page: parsePage(query.page),
    pageSize: parsePageSize(query.pageSize),
    status,
    category,
    barangayId,
    from,
    to,
    q: parseSearch(query.q)
  };
}

export function buildAlertHistoryWhere(
  principal: Principal,
  filters: AlertHistoryFilters
): Prisma.AlertWhereInput {
  const and: Prisma.AlertWhereInput[] = [];

  if (principal.role === 'LOW_LEVEL') {
    and.push({
      OR: [
        { createdByAdminId: principal.id },
        { targets: { some: { barangayId: principal.barangayId ?? '__none__' } } }
      ]
    });
  }

  if (filters.status) and.push({ status: filters.status });
  if (filters.category) and.push({ category: filters.category });

  if (filters.barangayId) {
    and.push({
      targets: {
        some: {
          OR: [{ barangayId: filters.barangayId }, { barangayId: null }]
        }
      }
    });
  }

  if (filters.from || filters.to) {
    and.push({
      createdAt: {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {})
      }
    });
  }

  if (filters.q) {
    and.push({ content: { contains: filters.q, mode: 'insensitive' } });
  }

  return { AND: and };
}

export async function listAlertHistory(
  prisma: PrismaClient,
  principal: Principal,
  filters: AlertHistoryFilters
) {
  const where = buildAlertHistoryWhere(principal, filters);
  const total = await prisma.alert.count({ where });
  const pagination = resolvePagination(filters.page, filters.pageSize, total);

  const [items, availableBarangays] = await Promise.all([
    prisma.alert.findMany({
      where,
      include: {
        targets: { select: { barangayId: true, residentRole: true } }
      },
      orderBy: ALERT_HISTORY_ORDER,
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize
    }),
    prisma.barangay.findMany({
      where:
        principal.role === 'LOW_LEVEL'
          ? { id: principal.barangayId ?? '__none__' }
          : {},
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    })
  ]);

  const failureCounts =
    items.length === 0
      ? []
      : await prisma.deliveryRecord.groupBy({
          by: ['alertId'],
          where: {
            alertId: { in: items.map((alert) => alert.id) },
            status: DeliveryStatus.FAILURE
          },
          _count: { _all: true }
        });
  const failureCountByAlert = new Map(
    failureCounts.map((entry) => [entry.alertId, entry._count._all])
  );

  return {
    ...pagination,
    items: items.map((alert) => ({
      id: alert.id,
      content: alert.content,
      category: alert.category,
      status: alert.status,
      targets: alert.targets,
      createdAt: alert.createdAt,
      confirmedAt: alert.confirmedAt,
      failureCount: failureCountByAlert.get(alert.id) ?? 0
    })),
    availableBarangays
  };
}
