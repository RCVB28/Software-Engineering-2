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

describeDb('report triage integration', () => {
  let barangayA: string;
  let barangayB: string;
  let residentToken: string;
  let highToken: string;
  let lowToken: string;

  beforeEach(async () => {
    await resetDatabase();
    const fixture = await createLocality();
    barangayA = fixture.barangays[0].id;
    barangayB = fixture.barangays[1].id;
    residentToken = (await createResident({ barangayId: barangayA })).token;
    highToken = (await createAdmin({ role: AdminRole.HIGH_LEVEL })).token;
    lowToken = (await createAdmin({ role: AdminRole.LOW_LEVEL, barangayId: barangayB })).token;
  });

  async function submit() {
    return request(app)
      .post('/api/reports')
      .set(authHeader(residentToken))
      .send({
        category: AlertCategory.FLOOD,
        severity: ReportSeverity.CRITICAL,
        description: 'River overflowed into the street',
        latitude: 14.6,
        longitude: 121.0
      });
  }

  it('records NEW status with an initial history row', async () => {
    const created = await submit();
    const history = await prisma.reportStatusHistory.findMany({
      where: { reportId: created.body.id }
    });
    expect(history).toHaveLength(1);
    expect(history[0].toStatus).toBe('NEW');
    expect(history[0].fromStatus).toBeNull();
  });

  it('allows acknowledge then resolve with history entries', async () => {
    const created = await submit();
    await request(app)
      .patch(`/api/admin/reports/${created.body.id}/status`)
      .set(authHeader(highToken))
      .send({ status: 'ACKNOWLEDGED' });
    await request(app)
      .patch(`/api/admin/reports/${created.body.id}/status`)
      .set(authHeader(highToken))
      .send({ status: 'RESOLVED' });

    const history = await prisma.reportStatusHistory.findMany({
      where: { reportId: created.body.id },
      orderBy: { changedAt: 'asc' }
    });
    expect(history.map((entry) => entry.toStatus)).toEqual(['NEW', 'ACKNOWLEDGED', 'RESOLVED']);
  });

  it('denies low-level admins from another barangay', async () => {
    const created = await submit();
    const response = await request(app)
      .patch(`/api/admin/reports/${created.body.id}/status`)
      .set(authHeader(lowToken))
      .send({ status: 'ACKNOWLEDGED' });
    expect(response.status).toBe(403);
  });

  it('escalates a report into a draft alert and links them', async () => {
    const created = await submit();
    const response = await request(app)
      .post(`/api/admin/reports/${created.body.id}/escalate`)
      .set(authHeader(highToken))
      .send({ content: 'Flood response: evacuate low-lying areas' });

    expect(response.status).toBe(201);
    expect(response.body.category).toBe(AlertCategory.FLOOD);
    expect(response.body.status).toBe('DRAFT');

    const report = await prisma.emergencyReport.findUnique({ where: { id: created.body.id } });
    expect(report?.escalatedAlertId).toBe(response.body.id);
  });

  it('allows dismissing a NEW report but blocks transitions from RESOLVED', async () => {
    const dismissed = await submit();
    const dismiss = await request(app)
      .patch(`/api/admin/reports/${dismissed.body.id}/status`)
      .set(authHeader(highToken))
      .send({ status: 'DISMISSED' });
    expect(dismiss.status).toBe(200);

    const reopened = await request(app)
      .patch(`/api/admin/reports/${dismissed.body.id}/status`)
      .set(authHeader(highToken))
      .send({ status: 'ACKNOWLEDGED' });
    expect(reopened.status).toBe(409);
  });
});
