import request from 'supertest';
import { AdminRole, AlertCategory, AlertStatus } from '@prisma/client';
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

describeDb('alert history contract', () => {
  let token: string;
  let lowToken: string;
  let adminId: string;
  let lowAdminId: string;
  let barangayA: string;
  let barangayB: string;

  beforeEach(async () => {
    await resetDatabase();
    const fixture = await createLocality();
    barangayA = fixture.barangays[0].id;
    barangayB = fixture.barangays[1].id;
    const admin = await createAdmin({ role: AdminRole.HIGH_LEVEL });
    const lowAdmin = await createAdmin({ role: AdminRole.LOW_LEVEL, barangayId: barangayA });
    token = admin.token;
    lowToken = lowAdmin.token;
    adminId = admin.admin.id;
    lowAdminId = lowAdmin.admin.id;
    await createResident({ barangayId: barangayA, phones: ['+639170000041'] });
  });

  async function seedAlert(options: {
    content: string;
    category?: AlertCategory;
    status?: AlertStatus;
    createdAt: Date;
    targetBarangayIds?: Array<string | null>;
    createdByAdminId?: string;
    failures?: number;
  }) {
    const alert = await prisma.alert.create({
      data: {
        content: options.content,
        category: options.category ?? AlertCategory.FLOOD,
        status: options.status ?? AlertStatus.COMPLETED,
        createdByAdminId: options.createdByAdminId ?? adminId,
        createdAt: options.createdAt,
        confirmedAt:
          (options.status ?? AlertStatus.COMPLETED) === AlertStatus.DRAFT
            ? null
            : new Date(options.createdAt.getTime() + 60_000),
        targets: {
          create: (options.targetBarangayIds ?? [barangayA]).map((barangayId) => ({
            barangayId
          }))
        }
      }
    });

    if (options.failures) {
      const resident = await prisma.resident.findFirstOrThrow();
      for (let index = 0; index < options.failures; index += 1) {
        await prisma.deliveryRecord.create({
          data: {
            alertId: alert.id,
            residentId: resident.id,
            phoneNumber: `+63917004${String(index).padStart(4, '0')}`,
            status: 'FAILURE',
            idempotencyKey: `${alert.id}:failure:${index}`
          }
        });
      }
    }

    return alert;
  }

  it('returns newest-first history fields and failure counts', async () => {
    const older = await seedAlert({
      content: 'Older alert',
      category: AlertCategory.FLOOD,
      createdAt: new Date('2026-01-01T00:00:00.000Z')
    });
    const newer = await seedAlert({
      content: 'Newer alert',
      category: AlertCategory.FIRE,
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      failures: 2
    });

    const response = await request(app)
      .get('/api/admin/alerts/history')
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      page: 1,
      pageSize: 20,
      total: 2,
      totalPages: 1,
      pageAdjusted: false
    });
    expect(response.body.items.map((item: any) => item.id)).toEqual([newer.id, older.id]);
    expect(response.body.items[0]).toMatchObject({
      id: newer.id,
      content: 'Newer alert',
      category: 'FIRE',
      status: 'COMPLETED',
      failureCount: 2
    });
    expect(response.body.items[0].targets).toEqual([
      expect.objectContaining({ barangayId: barangayA })
    ]);
    expect(response.body.items[0].createdAt).toBe('2026-01-02T00:00:00.000Z');
    expect(response.body.items[0].confirmedAt).toBeTruthy();
    expect(response.body.availableBarangays.map((item: any) => item.id).sort()).toEqual(
      [barangayA, barangayB].sort()
    );
  });

  it('supports each filter and combined filters', async () => {
    const draft = await seedAlert({
      content: 'Flood warning',
      category: AlertCategory.FLOOD,
      status: AlertStatus.DRAFT,
      createdAt: new Date('2026-01-05T00:00:00.000Z'),
      targetBarangayIds: [barangayA]
    });
    const fire = await seedAlert({
      content: 'Fire alarm',
      category: AlertCategory.FIRE,
      status: AlertStatus.COMPLETED,
      createdAt: new Date('2026-01-10T00:00:00.000Z'),
      targetBarangayIds: [barangayB]
    });
    const citywide = await seedAlert({
      content: 'Citywide flood',
      category: AlertCategory.FLOOD,
      status: AlertStatus.COMPLETED,
      createdAt: new Date('2026-01-20T00:00:00.000Z'),
      targetBarangayIds: [null]
    });

    async function ids(query: string) {
      const response = await request(app)
        .get(`/api/admin/alerts/history?${query}`)
        .set(authHeader(token));
      expect(response.status).toBe(200);
      return response.body.items.map((item: any) => item.id);
    }

    expect(await ids('status=COMPLETED')).toEqual([citywide.id, fire.id]);
    expect(await ids('category=FIRE')).toEqual([fire.id]);
    expect(await ids(`barangayId=${barangayA}`)).toEqual([citywide.id, draft.id]);
    expect(await ids('from=2026-01-15T00:00:00.000Z')).toEqual([citywide.id]);
    expect(await ids('to=2026-01-10T00:00:00.000Z')).toEqual([fire.id, draft.id]);
    expect(await ids('q=flood')).toEqual([citywide.id, draft.id]);
    expect(
      await ids(
        'status=COMPLETED&category=FLOOD&barangayId=' +
          `${barangayA}&from=2026-01-15T00:00:00.000Z&q=city`
      )
    ).toEqual([citywide.id]);
  });

  it('pages through ten pages without duplicates or omissions', async () => {
    const alerts = [];
    for (let index = 0; index < 12; index += 1) {
      alerts.push(
        await seedAlert({
          content: `History alert ${index}`,
          createdAt: new Date(Date.UTC(2026, 0, index + 1))
        })
      );
    }
    const expected = await prisma.alert.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 10
    });

    const seen: string[] = [];
    for (let page = 1; page <= 10; page += 1) {
      const response = await request(app)
        .get(`/api/admin/alerts/history?page=${page}&pageSize=1`)
        .set(authHeader(token));
      expect(response.status).toBe(200);
      seen.push(...response.body.items.map((item: any) => item.id));
    }

    expect(new Set(seen).size).toBe(10);
    expect(seen).toEqual(expected.map((item) => item.id));
  });

  it('clamps a page beyond the last valid page', async () => {
    for (let index = 0; index < 3; index += 1) {
      await seedAlert({
        content: `Clamp ${index}`,
        createdAt: new Date(Date.UTC(2026, 0, index + 1))
      });
    }

    const response = await request(app)
      .get('/api/admin/alerts/history?page=99&pageSize=2')
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      page: 2,
      pageSize: 2,
      total: 3,
      totalPages: 2,
      pageAdjusted: true
    });
    expect(response.body.items).toHaveLength(1);
  });

  it('returns an empty page envelope without adjustment', async () => {
    await seedAlert({
      content: 'Nothing matches',
      createdAt: new Date('2026-01-01T00:00:00.000Z')
    });

    const response = await request(app)
      .get('/api/admin/alerts/history?q=missing')
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      items: [],
      page: 1,
      total: 0,
      totalPages: 0,
      pageAdjusted: false
    });
  });

  it('scopes LOW_LEVEL results and available barangays', async () => {
    const own = await seedAlert({
      content: 'Own barangay',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      targetBarangayIds: [barangayA],
      createdByAdminId: lowAdminId
    });
    await seedAlert({
      content: 'Other barangay',
      createdAt: new Date('2026-01-03T00:00:00.000Z'),
      targetBarangayIds: [barangayB]
    });

    const response = await request(app)
      .get('/api/admin/alerts/history')
      .set(authHeader(lowToken));

    expect(response.status).toBe(200);
    expect(response.body.items.map((item: any) => item.id)).toEqual([own.id]);
    expect(response.body.availableBarangays.map((item: any) => item.id)).toEqual([barangayA]);

    const forbidden = await request(app)
      .get(`/api/admin/alerts/history?barangayId=${barangayB}`)
      .set(authHeader(lowToken));
    expect(forbidden.status).toBe(403);
  });

  it('requires an authenticated administrator', async () => {
    const anonymous = await request(app).get('/api/admin/alerts/history');
    expect(anonymous.status).toBe(401);

    const resident = await createResident({ barangayId: barangayA });
    const forbidden = await request(app)
      .get('/api/admin/alerts/history')
      .set(authHeader(resident.token));
    expect(forbidden.status).toBe(403);
  });
});
