import type { PrismaClient } from '@prisma/client';
import { dispatchAlert } from '../../src/modules/messaging/dispatch.service';
import { MockProvider } from '../../src/modules/messaging/mock.provider';

interface FakeRecord {
  id: string;
  alertId: string;
  status: string;
  attempts: number;
  providerMessageId?: string | null;
  lastError?: string | null;
}

function createFakePrisma() {
  const records = new Map<string, FakeRecord & { idempotencyKey: string }>();
  let sequence = 0;
  const findUnique = jest.fn(async ({ where }: any) => records.get(where.idempotencyKey) ?? null);
  const create = jest.fn(async ({ data }: any) => {
    const record = { id: `d${(sequence += 1)}`, status: 'SUBMITTED', attempts: 1, ...data };
    records.set(data.idempotencyKey, record);
    return record;
  });
  const update = jest.fn(async ({ where, data }: any) => {
    const record = [...records.values()].find((candidate) => candidate.id === where.id);
    Object.assign(record!, data);
    return record;
  });
  const count = jest.fn(
    async ({ where }: any) =>
      [...records.values()].filter(
        (record) =>
          record.status === where.status &&
          (where.alertId === undefined || record.alertId === where.alertId)
      ).length
  );
  const alertUpdate = jest.fn(async () => ({}));
  return {
    prisma: {
      alert: {
        update: alertUpdate,
        findUniqueOrThrow: jest.fn(async () => ({ createdByAdminId: 'admin-1', targets: [] }))
      },
      administrator: { findMany: jest.fn(async () => []) },
      failureNotification: { upsert: jest.fn(async () => ({})) },
      deliveryRecord: { findUnique, create, update, count }
    } as unknown as PrismaClient,
    records,
    alertUpdate
  };
}

describe('dispatchAlert', () => {
  it('records a delivery outcome per recipient phone and completes the alert', async () => {
    const { prisma, records, alertUpdate } = createFakePrisma();
    const provider = new MockProvider(0);

    await dispatchAlert(prisma, provider, 'alert-1', 'Evacuate now', [
      { residentId: 'r1', phoneNumbers: ['+639170000001', '+639170000002'] }
    ]);

    expect(provider.sent).toHaveLength(2);
    expect(records.size).toBe(2);
    expect([...records.values()].every((record) => record.status === 'SUCCESS')).toBe(true);
    expect(alertUpdate).toHaveBeenCalledWith({
      where: { id: 'alert-1' },
      data: { status: 'SENDING' }
    });
    expect(alertUpdate).toHaveBeenCalledWith({
      where: { id: 'alert-1' },
      data: { status: 'COMPLETED' }
    });
  });

  it('retries failed sends without duplicating successful ones', async () => {
    const { prisma, records } = createFakePrisma();
    const provider = new MockProvider(1);

    await dispatchAlert(prisma, provider, 'alert-2', 'Flood warning', [
      { residentId: 'r1', phoneNumbers: ['+639170000001'] }
    ]);
    expect([...records.values()][0].status).toBe('SUCCESS');
    expect(provider.sent).toHaveLength(1);
  });

  it('is idempotent across repeated dispatches of the same alert', async () => {
    const { prisma, records } = createFakePrisma();
    const provider = new MockProvider(0);
    const recipients = [{ residentId: 'r1', phoneNumbers: ['+639170000001'] }];

    await dispatchAlert(prisma, provider, 'alert-3', 'Stay indoors', recipients);
    await dispatchAlert(prisma, provider, 'alert-3', 'Stay indoors', recipients);

    expect(provider.sent).toHaveLength(1);
    expect(records.size).toBe(1);
  });

  it('marks deliveries as failed after exhausting retries', async () => {
    const { prisma, records } = createFakePrisma();
    const provider = new MockProvider(999);

    await dispatchAlert(prisma, provider, 'alert-4', 'Fire', [
      { residentId: 'r1', phoneNumbers: ['+639170000001'] }
    ]);

    const record = [...records.values()][0];
    expect(record.status).toBe('FAILURE');
    expect(record.attempts).toBe(3);
  });
});
