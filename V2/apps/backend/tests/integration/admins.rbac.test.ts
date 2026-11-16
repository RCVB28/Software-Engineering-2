import request from 'supertest';
import { AdminRole, AlertCategory, ReportSeverity } from '@prisma/client';
import { app } from '../../src/app';
import {
  ADMIN_PASSWORD,
  authHeader,
  createAdmin,
  createLocality,
  createResident,
  describeDb,
  resetDatabase
} from '../helpers/db';

describeDb('administrator RBAC integration', () => {
  let barangayA: string;
  let barangayB: string;
  let superToken: string;

  beforeEach(async () => {
    await resetDatabase();
    const fixture = await createLocality();
    barangayA = fixture.barangays[0].id;
    barangayB = fixture.barangays[1].id;
    superToken = (await createAdmin({ role: AdminRole.SUPERADMIN })).token;
  });

  it('creates accounts with consistent role and barangay assignments', async () => {
    const low = await request(app)
      .post('/api/admin/administrators')
      .set(authHeader(superToken))
      .send({
        email: 'barangay-admin@example.com',
        password: ADMIN_PASSWORD,
        role: AdminRole.LOW_LEVEL,
        barangayId: barangayA
      });
    expect(low.status).toBe(201);

    const login = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: 'barangay-admin@example.com', password: ADMIN_PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.user.barangayId).toBe(barangayA);
  });

  it('denies cross-barangay report access and allows own barangay', async () => {
    const residentA = await createResident({ barangayId: barangayA });
    const lowToken = (
      await createAdmin({ role: AdminRole.LOW_LEVEL, barangayId: barangayB })
    ).token;

    const report = await request(app)
      .post('/api/reports')
      .set(authHeader(residentA.token))
      .send({
        category: AlertCategory.MEDICAL,
        severity: ReportSeverity.HIGH,
        description: 'Medical emergency',
        addressText: 'Health center'
      });

    const denied = await request(app)
      .get(`/api/admin/reports/${report.body.id}`)
      .set(authHeader(lowToken));
    expect(denied.status).toBe(403);

    const ownResident = await createResident({ barangayId: barangayB });
    const ownReport = await request(app)
      .post('/api/reports')
      .set(authHeader(ownResident.token))
      .send({
        category: AlertCategory.SECURITY_THREAT,
        severity: ReportSeverity.MEDIUM,
        description: 'Suspicious activity',
        addressText: 'Corner store'
      });

    const allowed = await request(app)
      .get(`/api/admin/reports/${ownReport.body.id}`)
      .set(authHeader(lowToken));
    expect(allowed.status).toBe(200);
  });

  it('records account changes in the audit trail and retrieves them with filters', async () => {
    const created = await request(app)
      .post('/api/admin/administrators')
      .set(authHeader(superToken))
      .send({ email: 'trail@example.com', password: ADMIN_PASSWORD, role: AdminRole.HIGH_LEVEL });

    await request(app)
      .patch(`/api/admin/administrators/${created.body.id}`)
      .set(authHeader(superToken))
      .send({ isActive: false });

    const audit = await request(app)
      .get('/api/admin/audit?entityType=Administrator')
      .set(authHeader(superToken));
    const actions = audit.body.map((entry: any) => entry.action);
    expect(actions).toContain('ADMIN_CREATED');
    expect(actions).toContain('ADMIN_UPDATED');
  });

  it('prevents deactivated administrators from logging in', async () => {
    const { admin } = await createAdmin({ role: AdminRole.HIGH_LEVEL, email: 'inactive@example.com' });
    await request(app)
      .patch(`/api/admin/administrators/${admin.id}`)
      .set(authHeader(superToken))
      .send({ isActive: false });

    const login = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: 'inactive@example.com', password: ADMIN_PASSWORD });
    expect(login.status).toBe(401);
  });
});
