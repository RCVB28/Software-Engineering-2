import request from 'supertest';
import { AdminRole, AlertStatus, ResidentRole } from '@prisma/client';
import { app } from '../../src/app';
import {
  authHeader,
  createAdmin,
  createLocality,
  describeDb,
  prisma,
  resetDatabase
} from '../helpers/db';

jest.mock('../../src/modules/auth/google', () => ({
  verifyGoogleIdToken: jest.fn(async () => ({
    subject: 'google-sub-portal',
    email: 'portal-resident@example.com',
    name: 'Portal Resident'
  }))
}));

describeDb('subscriber portal integration', () => {
  let barangayA: string;
  let token: string;

  beforeEach(async () => {
    await resetDatabase();
    const fixture = await createLocality();
    barangayA = fixture.barangays[0].id;
    const registration = await request(app)
      .post('/api/auth/resident/google')
      .send({ idToken: 'fake-token', barangayId: barangayA, role: 'TEACHER' });
    token = registration.body.accessToken;
  });

  it('completes registration, consent, preferences, and phone linking', async () => {
    await request(app)
      .put('/api/residents/me/consent')
      .set(authHeader(token))
      .send({ granted: true, policyVersion: 'v1' });

    await request(app)
      .put('/api/residents/me/preferences')
      .set(authHeader(token))
      .send([{ category: 'FLOOD', optedIn: true }]);

    const phone = await request(app)
      .post('/api/residents/me/phones')
      .set(authHeader(token))
      .send({ number: '+639170000020' });

    expect(phone.status).toBe(201);

    const me = await request(app).get('/api/residents/me').set(authHeader(token));
    expect(me.body.role).toBe('TEACHER');
  });

  it('shows announcements for the resident role and barangay', async () => {
    const { admin } = await createAdmin({ role: AdminRole.HIGH_LEVEL });
    await prisma.alert.create({
      data: {
        content: 'Teachers report to the gym',
        category: 'OTHER',
        status: AlertStatus.COMPLETED,
        createdByAdminId: admin.id,
        targets: { create: [{ residentRole: ResidentRole.TEACHER }] }
      }
    });

    const announcements = await request(app)
      .get('/api/residents/me/announcements')
      .set(authHeader(token));
    expect(announcements.body).toHaveLength(1);
    expect(announcements.body[0].content).toBe('Teachers report to the gym');
  });

  it('returns an empty personal report history for a new resident', async () => {
    const reports = await request(app).get('/api/residents/me/reports').set(authHeader(token));
    expect(reports.status).toBe(200);
    expect(reports.body).toEqual([]);
  });
});
