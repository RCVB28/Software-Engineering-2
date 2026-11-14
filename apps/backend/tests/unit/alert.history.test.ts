import { AlertCategory, AlertStatus } from '@prisma/client';
import { AppError } from '../../src/middleware/error';
import { resolvePagination } from '../../src/middleware/query';
import {
  ALERT_HISTORY_ORDER,
  buildAlertHistoryWhere,
  parseAlertHistoryQuery
} from '../../src/modules/alerts/alert.history';
import type { Principal } from '../../src/types/auth';

const highAdmin: Principal = {
  id: 'admin-1',
  kind: 'ADMIN',
  role: 'HIGH_LEVEL',
  barangayId: null
};

const lowAdmin: Principal = {
  id: 'admin-low',
  kind: 'ADMIN',
  role: 'LOW_LEVEL',
  barangayId: 'barangay-a'
};

function expectValidationError(fn: () => unknown): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).status).toBe(400);
    expect((error as AppError).code).toBe('VALIDATION_ERROR');
    return;
  }
  throw new Error('Expected a validation error');
}

describe('alert history query', () => {
  it('applies paging defaults and clamps pages to the last valid page', () => {
    const filters = parseAlertHistoryQuery({}, highAdmin);
    expect(filters.page).toBe(1);
    expect(filters.pageSize).toBe(20);

    expect(resolvePagination(1, 10, 25)).toMatchObject({
      page: 1,
      totalPages: 3,
      pageAdjusted: false
    });
    expect(resolvePagination(99, 10, 25)).toMatchObject({
      page: 3,
      totalPages: 3,
      pageAdjusted: true
    });
    expect(resolvePagination(99, 10, 0)).toMatchObject({
      page: 1,
      totalPages: 0,
      pageAdjusted: false
    });
  });

  it('uses a stable newest-first order', () => {
    expect(ALERT_HISTORY_ORDER).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('ANDs status, category, barangay, date, and search filters', () => {
    const filters = parseAlertHistoryQuery(
      {
        status: AlertStatus.DRAFT,
        category: AlertCategory.FLOOD,
        barangayId: 'barangay-a',
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-31T00:00:00.000Z',
        q: '  flood  '
      },
      highAdmin
    );
    const where = buildAlertHistoryWhere(highAdmin, filters);

    expect(where.AND).toContainEqual({ status: AlertStatus.DRAFT });
    expect(where.AND).toContainEqual({ category: AlertCategory.FLOOD });
    expect(where.AND).toContainEqual({
      targets: {
        some: {
          OR: [{ barangayId: 'barangay-a' }, { barangayId: null }]
        }
      }
    });
    expect(where.AND).toContainEqual({
      createdAt: {
        gte: new Date('2026-01-01T00:00:00.000Z'),
        lte: new Date('2026-01-31T00:00:00.000Z')
      }
    });
    expect(where.AND).toContainEqual({
      content: { contains: 'flood', mode: 'insensitive' }
    });
  });

  it('matches a named target or an all-barangay target', () => {
    const where = buildAlertHistoryWhere(highAdmin, {
      ...parseAlertHistoryQuery({ barangayId: 'barangay-b' }, highAdmin)
    });

    expect(where.AND).toContainEqual({
      targets: {
        some: {
          OR: [{ barangayId: 'barangay-b' }, { barangayId: null }]
        }
      }
    });
  });

  it('applies LOW_LEVEL jurisdiction and restricts the barangay filter', () => {
    const filters = parseAlertHistoryQuery({ barangayId: 'barangay-a' }, lowAdmin);
    const where = buildAlertHistoryWhere(lowAdmin, filters);

    expect(where.AND).toContainEqual({
      OR: [
        { createdByAdminId: 'admin-low' },
        { targets: { some: { barangayId: 'barangay-a' } } }
      ]
    });

    try {
      parseAlertHistoryQuery({ barangayId: 'barangay-b' }, lowAdmin);
      throw new Error('Expected forbidden filter');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).status).toBe(403);
    }
  });

  it('rejects invalid filter inputs', () => {
    expectValidationError(() => parseAlertHistoryQuery({ status: 'SENT' }, highAdmin));
    expectValidationError(() => parseAlertHistoryQuery({ category: 'STORM' }, highAdmin));
    expectValidationError(() => parseAlertHistoryQuery({ page: '0' }, highAdmin));
    expectValidationError(() => parseAlertHistoryQuery({ pageSize: '101' }, highAdmin));
    expectValidationError(() => parseAlertHistoryQuery({ from: 'not-a-date' }, highAdmin));
    expectValidationError(() =>
      parseAlertHistoryQuery(
        { from: '2026-02-01T00:00:00.000Z', to: '2026-01-01T00:00:00.000Z' },
        highAdmin
      )
    );
    expectValidationError(() => parseAlertHistoryQuery({ q: 'x'.repeat(201) }, highAdmin));
  });
});
