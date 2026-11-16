import request from 'supertest';
import { AdminRole } from '@prisma/client';
import { app } from '../../src/app';
import {
  authHeader,
  createAdmin,
  createLocality,
  describeDb,
  resetDatabase
} from '../helpers/db';

describeDb('administrator and audit endpoints contract', () => {
  let superToken: string;
  let highToken: string;
  let barangayA: string;

  beforeEach(async () => {
    await resetDatabase();
    const fixture = await createLocality();
    barangayA = fixture.barangays[0].id;
    superToken = (await createAdmin({ role: AdminRole.SUPERADMIN })).token;
    highToken = (await createAdmin({ role: AdminRole.HIGH_LEVEL })).token;
  });

  it('creates a LOW_LEVEL administrator scoped to a barangay', async () => {
    const response = await request(app)
      .post('/api/admin/administrators')
      .set(authHeader(superToken))
      .send({
        email: 'low@example.com',
        password: 'Secret123!',
        role: AdminRole.LOW_LEVEL,
        barangayId: barangayA
      });
    expect(response.status).toBe(201);
    expect(response.body.role).toBe('LOW_LEVEL');
    expect(response.body.passwordHash).toBeUndefined();
  });

  it('rejects LOW_LEVEL administrators without a barangay', async () => {
    const response = await request(app)
      .post('/api/admin/administrators')
      .set(authHeader(superToken))
      .send({ email: 'low2@example.com', password: 'Secret123!', role: AdminRole.LOW_LEVEL });
    expect(response.status).toBe(400);
  });

  it('rejects duplicate administrator emails', async () => {
    await request(app)
      .post('/api/admin/administrators')
      .set(authHeader(superToken))
      .send({ email: 'dup@example.com', password: 'Secret123!', role: AdminRole.HIGH_LEVEL });
    const duplicate = await request(app)
      .post('/api/admin/administrators')
      .set(authHeader(superToken))
      .send({ email: 'dup@example.com', password: 'Secret123!', role: AdminRole.HIGH_LEVEL });
    expect(duplicate.status).toBe(409);
  });

  it('lists and updates administrators', async () => {
    const list = await request(app)
      .get('/api/admin/administrators')
      .set(authHeader(superToken));
    expect(list.status).toBe(200);
    expect(list.body.length).toBeGreaterThanOrEqual(2);

    const target = list.body.find((admin: any) => admin.role === 'HIGH_LEVEL');
    const updated = await request(app)
      .patch(`/api/admin/administrators/${target.id}`)
      .set(authHeader(superToken))
      .send({ displayName: 'Renamed', isActive: false });
    expect(updated.status).toBe(200);
    expect(updated.body.displayName).toBe('Renamed');
    expect(updated.body.isActive).toBe(false);
  });

  it('denies non-superadmins from managing accounts', async () => {
    const response = await request(app)
      .get('/api/admin/administrators')
      .set(authHeader(highToken));
    expect(response.status).toBe(403);
  });

  it('records and returns audit entries', async () => {
    await request(app)
      .post('/api/admin/administrators')
      .set(authHeader(superToken))
      .send({ email: 'audited@example.com', password: 'Secret123!', role: AdminRole.HIGH_LEVEL });

    const audit = await request(app)
      .get('/api/admin/audit?entityType=Administrator')
      .set(authHeader(superToken));
    expect(audit.status).toBe(200);
    expect(audit.body.some((entry: any) => entry.action === 'ADMIN_CREATED')).toBe(true);
  });

  it('denies low-level admins from reading the audit log', async () => {
    const lowToken = (
      await createAdmin({ role: AdminRole.LOW_LEVEL, barangayId: barangayA })
    ).token;
    const response = await request(app).get('/api/admin/audit').set(authHeader(lowToken));
    expect(response.status).toBe(403);
  });
});
