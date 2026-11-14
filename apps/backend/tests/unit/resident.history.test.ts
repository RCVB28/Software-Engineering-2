import type { PrismaClient } from '@prisma/client';
import {
  aggregateResidentOutcome,
  listResidentAlertHistory,
  resolveResidentAlertSentAt
} from '../../src/modules/residents/resident.service';

describe('resident alert history', () => {
  it('aggregates delivery outcomes', () => {
    expect(aggregateResidentOutcome(['SUCCESS'])).toBe('SUCCESS');
    expect(aggregateResidentOutcome(['SUCCESS', 'SUCCESS'])).toBe('SUCCESS');
    expect(aggregateResidentOutcome(['FAILURE'])).toBe('FAILURE');
    expect(aggregateResidentOutcome(['SUCCESS', 'FAILURE'])).toBe('PARTIAL');
    expect(aggregateResidentOutcome(['SUBMITTED', 'SUCCESS'])).toBe('PENDING');
    expect(aggregateResidentOutcome(['DELAYED'])).toBe('PENDING');
  });

  it('falls back to the creation time when confirmation time is missing', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const confirmedAt = new Date('2026-01-02T00:00:00.000Z');

    expect(resolveResidentAlertSentAt({ confirmedAt, createdAt })).toEqual(confirmedAt);
    expect(resolveResidentAlertSentAt({ confirmedAt: null, createdAt })).toEqual(createdAt);
  });

  it('clamps pages to the last valid page', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      alert: {
        count: jest.fn().mockResolvedValue(3),
        findMany
      }
    } as unknown as PrismaClient;

    const result = await listResidentAlertHistory(prisma, 'resident-1', 99, 2);

    expect(result).toMatchObject({
      page: 2,
      pageSize: 2,
      total: 3,
      totalPages: 2,
      pageAdjusted: true
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 2, take: 2 })
    );
  });
});
