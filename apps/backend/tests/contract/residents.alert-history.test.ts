import request from 'supertest';
import { AdminRole, AlertCategory, AlertStatus, DeliveryStatus } from '@prisma/client';
import { app } from '../../src/app';
import {
  authHeader,
  createAdmin,
  createLocality,
  createResident,
  describeDb,
  prisma,
  resetDatabase
} from '../helpers/db';

describeDb('resident alert history contract', () => {
  let barangayId: string;
  let residentToken: string;
  let residentId: string;
  let otherResidentId: string;
  let otherToken: string;

  beforeEach(async () => {
    await resetDatabase();
    const fixture = await createLocality();
    barangayId = fixture.barangays[0].id;
    const resident = await createResident({
      barangayId,
      phones: ['+639170000051'],
      email: 'history-one@example.com'
    });
    const other = await createResident({
      barangayId,
      phones: ['+639170000052'],
      email: 'history-two@example.com'
    });
    residentToken = resident.token;
    residentId = resident.resident.id;
    otherToken = other.token;
    otherResidentId = other.resident.id;
  });

  async function seedAlert(options: {
    content: string;
    createdAt: Date;
    confirmedAt?: Date | null;
    deliveries: Array<{ residentId: string; status: DeliveryStatus }>;
  }) {
    const admin = await createAdmin({ role: AdminRole.HIGH_LEVEL });
    const alert = await prisma.alert.create({
      data: {
        content: options.content,
        category: AlertCategory.FLOOD,
        status: AlertStatus.COMPLETED,
        createdByAdminId: admin.admin.id,
        createdAt: options.createdAt,
        confirmedAt:
          options.confirmedAt === undefined
            ? new Date(options.createdAt.getTime() + 60_000)
            : options.confirmedAt,
        targets: { create: [{ barangayId }] }
      }
    });

    for (let index = 0; index < options.deliveries.length; index += 1) {
      const delivery = options.deliveries[index];
      await prisma.deliveryRecord.create({
        data: {
          alertId: alert.id,
          residentId: delivery.residentId,
          phoneNumber: `+63917005${String(index).padStart(4, '0')}`,
          status: delivery.status,
          idempotencyKey: `${alert.id}:${delivery.residentId}:${index}`
        }
      });
    }

    return alert;
  }

  it('returns only the requesting resident alerts and their own outcomes', async () => {
    const mixed = await seedAlert({
      content: 'Shared alert',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      deliveries: [
        { residentId, status: DeliveryStatus.SUCCESS },
        { residentId: otherResidentId, status: DeliveryStatus.FAILURE }
      ]
    });
    await seedAlert({
      content: 'Other resident only',
      createdAt: new Date('2026-01-03T00:00:00.000Z'),
      deliveries: [{ residentId: otherResidentId, status: DeliveryStatus.SUCCESS }]
    });

    const response = await request(app)
      .get('/api/residents/me/alert-history')
      .set(authHeader(residentToken));

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      alertId: mixed.id,
      content: 'Shared alert',
      category: 'FLOOD',
      outcome: 'SUCCESS'
    });
  });

  it('orders newest first and pages without duplicates', async () => {
    const alerts = [];
    for (let index = 0; index < 12; index += 1) {
      alerts.push(
        await seedAlert({
          content: `Resident alert ${index}`,
          createdAt: new Date(Date.UTC(2026, 0, index + 1)),
          deliveries: [{ residentId, status: DeliveryStatus.SUCCESS }]
        })
      );
    }

    const seen: string[] = [];
    for (let page = 1; page <= 3; page += 1) {
      const response = await request(app)
        .get(`/api/residents/me/alert-history?page=${page}&pageSize=5`)
        .set(authHeader(residentToken));
      expect(response.status).toBe(200);
      seen.push(...response.body.items.map((item: any) => item.alertId));
    }

    expect(new Set(seen).size).toBe(12);
    expect(seen).toEqual(
      [...alerts].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map((a) => a.id)
    );
  });

  it('updates a pending delivery outcome to the final outcome', async () => {
    const alert = await seedAlert({
      content: 'Pending alert',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      deliveries: [{ residentId, status: DeliveryStatus.SUBMITTED }]
    });

    const pending = await request(app)
      .get('/api/residents/me/alert-history')
      .set(authHeader(residentToken));
    expect(pending.body.items[0]).toMatchObject({ alertId: alert.id, outcome: 'PENDING' });

    await prisma.deliveryRecord.updateMany({
      where: { alertId: alert.id, residentId },
      data: { status: DeliveryStatus.SUCCESS }
    });

    const final = await request(app)
      .get('/api/residents/me/alert-history')
      .set(authHeader(residentToken));
    expect(final.body.items[0]).toMatchObject({ alertId: alert.id, outcome: 'SUCCESS' });
  });

  it('returns a sent time from confirmation or the creation fallback', async () => {
    const confirmed = await seedAlert({
      content: 'Confirmed sent time',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      confirmedAt: new Date('2026-01-02T00:05:00.000Z'),
      deliveries: [{ residentId, status: DeliveryStatus.SUCCESS }]
    });
    const legacy = await seedAlert({
      content: 'Legacy sent time',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      confirmedAt: null,
      deliveries: [{ residentId, status: DeliveryStatus.SUCCESS }]
    });

    const response = await request(app)
      .get('/api/residents/me/alert-history')
      .set(authHeader(residentToken));

    const byId = new Map(response.body.items.map((item: any) => [item.alertId, item]));
    expect((byId.get(confirmed.id) as any).sentAt).toBe('2026-01-02T00:05:00.000Z');
    expect((byId.get(legacy.id) as any).sentAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('returns an empty page for a resident with no deliveries', async () => {
    const fresh = await createResident({
      barangayId,
      phones: ['+639170000053'],
      email: 'history-empty@example.com'
    });

    const response = await request(app)
      .get('/api/residents/me/alert-history')
      .set(authHeader(fresh.token));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      items: [],
      page: 1,
      total: 0,
      totalPages: 0,
      pageAdjusted: false
    });
  });

  it('denies anonymous and administrator access', async () => {
    const anonymous = await request(app).get('/api/residents/me/alert-history');
    expect(anonymous.status).toBe(401);

    const admin = await createAdmin({ role: AdminRole.HIGH_LEVEL });
    const forbidden = await request(app)
      .get('/api/residents/me/alert-history')
      .set(authHeader(admin.token));
    expect(forbidden.status).toBe(403);

    const other = await request(app)
      .get('/api/residents/me/alert-history')
      .set(authHeader(otherToken));
    expect(other.status).toBe(200);
    expect(other.body.items).toEqual([]);
  });
});
