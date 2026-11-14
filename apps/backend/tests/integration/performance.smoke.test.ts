import request from 'supertest';
import { AdminRole, AlertCategory, AlertStatus } from '@prisma/client';
import { app } from '../../src/app';
import {
  authHeader,
  createAdmin,
  createLocality,
  describeDb,
  prisma,
  resetDatabase
} from '../helpers/db';

describeDb('performance smoke test', () => {
  it('previews 1,000 targeted residents within the budget', async () => {
    await resetDatabase();
    const fixture = await createLocality(['Performance Barangay']);
    const barangayId = fixture.barangays[0].id;

    const residents = Array.from({ length: 1000 }, (_, index) => ({
      id: `perf-resident-${index}`,
      googleSubject: `perf-google-${index}`,
      email: `perf-${index}@example.com`,
      displayName: `Resident ${index}`,
      barangayId
    }));
    await prisma.resident.createMany({ data: residents });
    await prisma.phoneNumber.createMany({
      data: residents.map((resident, index) => ({
        residentId: resident.id,
        number: `+63917${String(index).padStart(7, '0')}`,
        isPrimary: true
      }))
    });
    await prisma.consent.createMany({
      data: residents.map((resident) => ({
        residentId: resident.id,
        granted: true,
        policyVersion: 'v1'
      }))
    });

    const token = (await createAdmin({ role: AdminRole.HIGH_LEVEL })).token;
    const created = await request(app)
      .post('/api/admin/alerts')
      .set(authHeader(token))
      .send({
        content: 'Performance smoke broadcast',
        category: AlertCategory.FLOOD,
        targets: [{ barangayId }]
      });

    const startedAt = Date.now();
    const preview = await request(app)
      .get(`/api/admin/alerts/${created.body.id}/recipients`)
      .set(authHeader(token));
    const elapsed = Date.now() - startedAt;

    expect(preview.status).toBe(200);
    expect(preview.body.count).toBe(1000);
    expect(elapsed).toBeLessThan(5000);
  });

  it('returns the first history page and a combined filter within 2 seconds for 10,000 alerts', async () => {
    await resetDatabase();
    const fixture = await createLocality(['History Performance Barangay']);
    const barangayId = fixture.barangays[0].id;
    const admin = await createAdmin({ role: AdminRole.HIGH_LEVEL });
    const token = admin.token;
    const baseTime = new Date('2026-01-01T00:00:00.000Z').getTime();

    const alerts = Array.from({ length: 10_000 }, (_, index) => ({
      id: `perf-alert-${index}`,
      content: `Performance alert ${index} for evacuation planning`,
      category: index % 2 === 0 ? AlertCategory.FLOOD : AlertCategory.FIRE,
      createdByAdminId: admin.admin.id,
      status: AlertStatus.COMPLETED,
      createdAt: new Date(baseTime + index * 60_000)
    }));

    for (let start = 0; start < alerts.length; start += 1000) {
      await prisma.alert.createMany({ data: alerts.slice(start, start + 1000) });
    }
    for (let start = 0; start < alerts.length; start += 1000) {
      await prisma.alertTarget.createMany({
        data: alerts.slice(start, start + 1000).map((alert) => ({
          alertId: alert.id,
          barangayId
        }))
      });
    }

    await prisma.$executeRawUnsafe('ANALYZE "Alert"');
    await prisma.$executeRawUnsafe('ANALYZE "AlertTarget"');

    const firstPageStarted = Date.now();
    const firstPage = await request(app)
      .get('/api/admin/alerts/history?page=1&pageSize=20')
      .set(authHeader(token));
    const firstPageElapsed = Date.now() - firstPageStarted;

    expect(firstPage.status).toBe(200);
    expect(firstPage.body.total).toBe(10_000);
    expect(firstPage.body.items).toHaveLength(20);
    expect(firstPageElapsed).toBeLessThan(2000);

    const filteredStarted = Date.now();
    const filtered = await request(app)
      .get(
        `/api/admin/alerts/history?status=COMPLETED&category=FLOOD&barangayId=${barangayId}` +
          '&from=2026-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.999Z&q=Performance&page=1&pageSize=20'
      )
      .set(authHeader(token));
    const filteredElapsed = Date.now() - filteredStarted;

    expect(filtered.status).toBe(200);
    expect(filtered.body.total).toBe(5000);
    expect(filteredElapsed).toBeLessThan(2000);
  });
});