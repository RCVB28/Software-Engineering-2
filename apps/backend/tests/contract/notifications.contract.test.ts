import request from 'supertest';
import { AdminRole, AlertCategory } from '@prisma/client';
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

describeDb('notification endpoints contract', () => {
  let token: string;
  let residentToken: string;
  let adminId: string;
  let otherAdminId: string;
  let alertId: string;

  beforeEach(async () => {
    await resetDatabase();
    const fixture = await createLocality();
    const admin = await createAdmin({ role: AdminRole.HIGH_LEVEL });
    const other = await createAdmin({ role: AdminRole.HIGH_LEVEL });
    token = admin.token;
    adminId = admin.admin.id;
    otherAdminId = other.admin.id;
    residentToken = (
      await createResident({ barangayId: fixture.barangays[0].id, phones: ['+639170000031'] })
    ).token;

    const draft = await request(app)
      .post('/api/admin/alerts')
      .set(authHeader(token))
      .send({
        content: 'Failure alert',
        category: AlertCategory.FIRE,
        targets: [{ barangayId: fixture.barangays[0].id }]
      });
    alertId = draft.body.id;
  });

  async function createAlert(content: string) {
    const draft = await request(app)
      .post('/api/admin/alerts')
      .set(authHeader(token))
      .send({
        content,
        category: AlertCategory.FIRE,
        targets: [{ barangayId: (await prisma.barangay.findFirstOrThrow()).id }]
      });
    return draft.body.id as string;
  }

  async function createNotification(
    overrides: {
      adminId?: string;
      alertId?: string;
      failureCount?: number;
      createdAt?: Date;
    } = {}
  ) {
    return prisma.failureNotification.create({
      data: {
        adminId: overrides.adminId ?? adminId,
        alertId: overrides.alertId ?? alertId,
        failureCount: overrides.failureCount ?? 2,
        completedAt: new Date('2026-01-02T03:04:05.000Z'),
        ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {})
      }
    });
  }

  it('lists the caller notifications with an unread count and paging envelope', async () => {
    const olderAlertId = await createAlert('Older failure alert');
    const older = await createNotification({
      alertId: olderAlertId,
      failureCount: 1,
      createdAt: new Date('2026-01-01T00:00:00.000Z')
    });
    const newer = await createNotification({
      failureCount: 2,
      createdAt: new Date('2026-01-03T00:00:00.000Z')
    });
    await createNotification({ adminId: otherAdminId });

    const response = await request(app)
      .get('/api/admin/notifications?page=1&pageSize=1')
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      page: 1,
      pageSize: 1,
      total: 2,
      totalPages: 2,
      unreadCount: 2
    });
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      id: newer.id,
      alertId,
      alertCategory: 'FIRE',
      alertContent: 'Failure alert',
      failureCount: 2,
      readAt: null
    });
    expect(response.body.items[0].createdAt).toBeTruthy();
    expect(response.body.items[0].completedAt).toBe('2026-01-02T03:04:05.000Z');

    const pageTwo = await request(app)
      .get('/api/admin/notifications?page=2&pageSize=1')
      .set(authHeader(token));
    expect(pageTwo.body.items[0].id).toBe(older.id);
  });

  it('filters unread notifications while keeping the total unread count', async () => {
    const secondAlertId = await createAlert('Second failure alert');
    const first = await createNotification({ createdAt: new Date('2026-01-01T00:00:00.000Z') });
    await createNotification({
      alertId: secondAlertId,
      createdAt: new Date('2026-01-02T00:00:00.000Z')
    });
    await prisma.failureNotification.update({
      where: { id: first.id },
      data: { readAt: new Date('2026-01-04T00:00:00.000Z') }
    });

    const unread = await request(app)
      .get('/api/admin/notifications?unreadOnly=true')
      .set(authHeader(token));

    expect(unread.status).toBe(200);
    expect(unread.body.total).toBe(1);
    expect(unread.body.unreadCount).toBe(1);
    expect(unread.body.items[0].readAt).toBeNull();

    const all = await request(app)
      .get('/api/admin/notifications?unreadOnly=false')
      .set(authHeader(token));
    expect(all.body.total).toBe(2);
    expect(all.body.unreadCount).toBe(1);
  });

  it('acknowledges idempotently, decreases unread count, and keeps history', async () => {
    const notification = await createNotification();

    const first = await request(app)
      .post(`/api/admin/notifications/${notification.id}/acknowledge`)
      .set(authHeader(token));
    expect(first.status).toBe(200);
    expect(first.body.readAt).not.toBeNull();
    const readAt = first.body.readAt;

    const second = await request(app)
      .post(`/api/admin/notifications/${notification.id}/acknowledge`)
      .set(authHeader(token));
    expect(second.status).toBe(200);
    expect(second.body.readAt).toBe(readAt);

    const list = await request(app)
      .get('/api/admin/notifications')
      .set(authHeader(token));
    expect(list.body.total).toBe(1);
    expect(list.body.unreadCount).toBe(0);
    expect(list.body.items[0].id).toBe(notification.id);

    const unread = await request(app)
      .get('/api/admin/notifications?unreadOnly=true')
      .set(authHeader(token));
    expect(unread.body.total).toBe(0);
    expect(unread.body.items).toEqual([]);
  });

  it('returns 404 for unknown notifications and another administrator notifications', async () => {
    const otherNotification = await createNotification({ adminId: otherAdminId });

    const otherResponse = await request(app)
      .post(`/api/admin/notifications/${otherNotification.id}/acknowledge`)
      .set(authHeader(token));
    expect(otherResponse.status).toBe(404);

    const unknown = await request(app)
      .post('/api/admin/notifications/00000000-0000-0000-0000-000000000000/acknowledge')
      .set(authHeader(token));
    expect(unknown.status).toBe(404);
  });

  it('requires an authenticated administrator', async () => {
    const anonymous = await request(app).get('/api/admin/notifications');
    expect(anonymous.status).toBe(401);

    const resident = await request(app)
      .get('/api/admin/notifications')
      .set(authHeader(residentToken));
    expect(resident.status).toBe(403);
  });

  it('rejects invalid paging values', async () => {
    const response = await request(app)
      .get('/api/admin/notifications?page=0&pageSize=101')
      .set(authHeader(token));
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });
});
