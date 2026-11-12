import request from 'supertest';
import { AdminRole, AlertCategory } from '@prisma/client';
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
});
