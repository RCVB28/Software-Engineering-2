import request from 'supertest';
import { AdminRole, AlertCategory } from '@prisma/client';
import { app } from '../../src/app';
import { fanOutFailureNotifications } from '../../src/modules/notifications/notification.service';
import {
  authHeader,
  createAdmin,
  createLocality,
  createResident,
  describeDb,
  prisma,
  resetDatabase
} from '../helpers/db';
import { useMockMessaging } from '../helpers/messaging';

describeDb('failure notification fan-out', () => {
  async function createAlert(token: string, barangayId: string) {
    return request(app)
      .post('/api/admin/alerts')
      .set(authHeader(token))
      .send({
        content: 'Evacuate now',
        category: AlertCategory.FLOOD,
        targets: [{ barangayId }]
      });
  }

  it('creates no notifications when every delivery succeeds', async () => {
    await resetDatabase();
    useMockMessaging();
    const fixture = await createLocality();
    const barangayId = fixture.barangays[0].id;
    const token = (await createAdmin({ role: AdminRole.HIGH_LEVEL })).token;
    await createResident({ barangayId, phones: ['+639170000021'] });

    const draft = await createAlert(token, barangayId);
    const confirmed = await request(app)
      .post(`/api/admin/alerts/${draft.body.id}/confirm`)
      .set(authHeader(token));

    expect(confirmed.status).toBe(200);
    await expect(prisma.failureNotification.count()).resolves.toBe(0);
  });

  it('creates no notifications when a retry eventually succeeds', async () => {
    await resetDatabase();
    useMockMessaging(1);
    const fixture = await createLocality();
    const barangayId = fixture.barangays[0].id;
    const token = (await createAdmin({ role: AdminRole.HIGH_LEVEL })).token;
    await createResident({ barangayId, phones: ['+639170000022'] });

    const draft = await createAlert(token, barangayId);
    await request(app)
      .post(`/api/admin/alerts/${draft.body.id}/confirm`)
      .set(authHeader(token));

    await expect(prisma.deliveryRecord.count({ where: { status: 'SUCCESS' } })).resolves.toBe(1);
    await expect(prisma.failureNotification.count()).resolves.toBe(0);
  });

  it('creates one notification for each authorized active administrator', async () => {
    await resetDatabase();
    const mock = useMockMessaging();
    const fixture = await createLocality();
    const barangayA = fixture.barangays[0].id;
    const barangayB = fixture.barangays[1].id;
    const creator = await createAdmin({ role: AdminRole.HIGH_LEVEL });
    const superadmin = await createAdmin({ role: AdminRole.SUPERADMIN });
    const lowA = await createAdmin({ role: AdminRole.LOW_LEVEL, barangayId: barangayA });
    const lowB = await createAdmin({ role: AdminRole.LOW_LEVEL, barangayId: barangayB });
    const inactive = await createAdmin({ role: AdminRole.HIGH_LEVEL });
    await prisma.administrator.update({ where: { id: inactive.admin.id }, data: { isActive: false } });
    await createResident({ barangayId: barangayA, phones: ['+639170000023'] });
    await createResident({ barangayId: barangayA, phones: ['+639170000024'] });

    mock.setFailures(100);
    const draft = await createAlert(creator.token, barangayA);
    const confirmed = await request(app)
      .post(`/api/admin/alerts/${draft.body.id}/confirm`)
      .set(authHeader(creator.token));
    expect(confirmed.status).toBe(200);

    const notifications = await prisma.failureNotification.findMany({
      where: { alertId: draft.body.id },
      include: { alert: true }
    });
    expect(notifications).toHaveLength(3);
    expect(notifications.map((item) => item.adminId).sort()).toEqual(
      [creator.admin.id, superadmin.admin.id, lowA.admin.id].sort()
    );
    expect(notifications.every((item) => item.failureCount === 2)).toBe(true);
    expect(notifications.every((item) => item.completedAt instanceof Date)).toBe(true);
    expect(notifications.some((item) => item.adminId === lowB.admin.id)).toBe(false);
    expect(notifications.some((item) => item.adminId === inactive.admin.id)).toBe(false);
  });

  it('does not duplicate notifications when the same alert is processed again', async () => {
    await resetDatabase();
    const mock = useMockMessaging();
    const fixture = await createLocality();
    const barangayId = fixture.barangays[0].id;
    const creator = await createAdmin({ role: AdminRole.HIGH_LEVEL });
    await createResident({ barangayId, phones: ['+639170000025'] });

    mock.setFailures(100);
    const draft = await createAlert(creator.token, barangayId);
    await request(app)
      .post(`/api/admin/alerts/${draft.body.id}/confirm`)
      .set(authHeader(creator.token));

    const initial = await prisma.failureNotification.findMany({
      where: { alertId: draft.body.id }
    });
    expect(initial).toHaveLength(1);

    await fanOutFailureNotifications(prisma, draft.body.id, new Date());
    await fanOutFailureNotifications(prisma, draft.body.id, new Date());

    const after = await prisma.failureNotification.findMany({ where: { alertId: draft.body.id } });
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe(initial[0].id);
  });

  it('does not notify a low-level administrator outside every target barangay', async () => {
    await resetDatabase();
    const mock = useMockMessaging();
    const fixture = await createLocality();
    const barangayA = fixture.barangays[0].id;
    const barangayB = fixture.barangays[1].id;
    const creator = await createAdmin({ role: AdminRole.HIGH_LEVEL });
    const lowB = await createAdmin({ role: AdminRole.LOW_LEVEL, barangayId: barangayB });
    await createResident({ barangayId: barangayA, phones: ['+639170000026'] });

    mock.setFailures(100);
    const draft = await createAlert(creator.token, barangayA);
    await request(app)
      .post(`/api/admin/alerts/${draft.body.id}/confirm`)
      .set(authHeader(creator.token));

    await expect(
      prisma.failureNotification.count({ where: { adminId: lowB.admin.id } })
    ).resolves.toBe(0);
  });
});
