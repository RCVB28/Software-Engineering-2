import request from 'supertest';
import { AdminRole, AlertCategory, ReportSeverity } from '@prisma/client';
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

describeDb('report endpoints contract', () => {
  let barangayA: string;
  let barangayB: string;
  let residentToken: string;
  let highToken: string;
  let lowToken: string;
  let superToken: string;

  beforeEach(async () => {
    await resetDatabase();
    const fixture = await createLocality();
    barangayA = fixture.barangays[0].id;
    barangayB = fixture.barangays[1].id;
    residentToken = (await createResident({ barangayId: barangayA })).token;
    highToken = (await createAdmin({ role: AdminRole.HIGH_LEVEL })).token;
    lowToken = (await createAdmin({ role: AdminRole.LOW_LEVEL, barangayId: barangayB })).token;
    superToken = (await createAdmin({ role: AdminRole.SUPERADMIN })).token;
  });

  async function submitReport(overrides: Record<string, unknown> = {}) {
    return request(app)
      .post('/api/reports')
      .set(authHeader(residentToken))
      .send({
        category: AlertCategory.FIRE,
        severity: ReportSeverity.HIGH,
        description: 'Smoke seen near the school',
        addressText: '5 Rizal Street',
        ...overrides
      });
  }

  it('stores a report as NEW', async () => {
    const response = await submitReport();
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('NEW');
    expect(response.body.barangayId).toBe(barangayA);
  });

  it('rejects descriptions over 500 characters', async () => {
    const response = await submitReport({ description: 'x'.repeat(501) });
    expect(response.status).toBe(400);
  });

  it('returns the resident own reports', async () => {
    await submitReport();
    const response = await request(app)
      .get('/api/residents/me/reports')
      .set(authHeader(residentToken));
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
  });

  it('scopes reports for low-level admins', async () => {
    const created = await submitReport();
    const highList = await request(app).get('/api/admin/reports').set(authHeader(highToken));
    expect(highList.body).toHaveLength(1);

    const lowList = await request(app).get('/api/admin/reports').set(authHeader(lowToken));
    expect(lowList.body).toHaveLength(0);

    const denied = await request(app)
      .get(`/api/admin/reports/${created.body.id}`)
      .set(authHeader(lowToken));
    expect(denied.status).toBe(403);
  });

  it('applies the report lifecycle transitions', async () => {
    const created = await submitReport();
    const acknowledged = await request(app)
      .patch(`/api/admin/reports/${created.body.id}/status`)
      .set(authHeader(highToken))
      .send({ status: 'ACKNOWLEDGED' });
    expect(acknowledged.status).toBe(200);

    const resolved = await request(app)
      .patch(`/api/admin/reports/${created.body.id}/status`)
      .set(authHeader(highToken))
      .send({ status: 'RESOLVED' });
    expect(resolved.status).toBe(200);

    const invalid = await request(app)
      .patch(`/api/admin/reports/${created.body.id}/status`)
      .set(authHeader(highToken))
      .send({ status: 'ACKNOWLEDGED' });
    expect(invalid.status).toBe(409);
  });

  it('escalates reports to a draft alert for high-level admins only', async () => {
    const created = await submitReport();
    const escalated = await request(app)
      .post(`/api/admin/reports/${created.body.id}/escalate`)
      .set(authHeader(highToken))
      .send({ content: 'Respond to the reported fire' });
    expect(escalated.status).toBe(201);
    expect(escalated.body.status).toBe('DRAFT');
    expect(escalated.body.targets[0].barangayId).toBe(barangayA);

    const again = await request(app)
      .post(`/api/admin/reports/${created.body.id}/escalate`)
      .set(authHeader(highToken))
      .send({ content: 'Duplicate' });
    expect(again.status).toBe(409);

    const stored = await prisma.emergencyReport.findUnique({ where: { id: created.body.id } });
    expect(stored?.escalatedAlertId).toBe(escalated.body.id);

    const asSuper = await request(app)
      .post(`/api/admin/reports/${created.body.id}/escalate`)
      .set(authHeader(superToken))
      .send({ content: 'Superadmin attempt' });
    expect(asSuper.status).toBe(403);
  });

  it('requires a resident token to submit reports', async () => {
    const response = await request(app).post('/api/reports').send({
      category: AlertCategory.FIRE,
      severity: ReportSeverity.LOW,
      description: 'Anonymous',
      addressText: 'Somewhere'
    });
    expect(response.status).toBe(401);
  });
});
