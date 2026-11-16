import request from 'supertest';
import { AdminRole, AlertStatus } from '@prisma/client';
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
    subject: 'google-sub-contract',
    email: 'contract-resident@example.com',
    name: 'Contract Resident'
  }))
}));

describeDb('resident endpoints contract', () => {
  let barangayA: string;
  let barangayB: string;
  let token: string;

  beforeEach(async () => {
    await resetDatabase();
    const fixture = await createLocality();
    barangayA = fixture.barangays[0].id;
    barangayB = fixture.barangays[1].id;
    const registration = await request(app)
      .post('/api/auth/resident/google')
      .send({ idToken: 'fake-google-token', barangayId: barangayA });
    token = registration.body.accessToken;
  });

  it('registers a resident through Google sign-in', async () => {
    expect(token).toBeDefined();
    const me = await request(app).get('/api/residents/me').set(authHeader(token));
    expect(me.status).toBe(200);
    expect(me.body.email).toBe('contract-resident@example.com');
    expect(me.body.barangayId).toBe(barangayA);
  });

  it('updates the profile and links phones with a single primary', async () => {
    const updated = await request(app)
      .patch('/api/residents/me')
      .set(authHeader(token))
      .send({ displayName: 'Updated Name', role: 'STUDENT' });
    expect(updated.status).toBe(200);
    expect(updated.body.displayName).toBe('Updated Name');
    expect(updated.body.role).toBe('STUDENT');

    const first = await request(app)
      .post('/api/residents/me/phones')
      .set(authHeader(token))
      .send({ number: '+639170000010' });
    expect(first.status).toBe(201);
    expect(first.body.isPrimary).toBe(true);

    const second = await request(app)
      .post('/api/residents/me/phones')
      .set(authHeader(token))
      .send({ number: '+639170000011', isPrimary: true });
    expect(second.status).toBe(201);

    const phones = await request(app).get('/api/residents/me/phones').set(authHeader(token));
    expect(phones.body.filter((phone: any) => phone.isPrimary)).toHaveLength(1);
    expect(phones.body.find((phone: any) => phone.isPrimary).number).toBe('+639170000011');

    const duplicate = await request(app)
      .post('/api/residents/me/phones')
      .set(authHeader(token))
      .send({ number: '+639170000010' });
    expect(duplicate.status).toBe(409);

    const removed = await request(app)
      .delete(`/api/residents/me/phones/${second.body.id}`)
      .set(authHeader(token));
    expect(removed.status).toBe(204);
  });

  it('records consent with a policy version', async () => {
    const response = await request(app)
      .put('/api/residents/me/consent')
      .set(authHeader(token))
      .send({ granted: true, policyVersion: '2026-11' });
    expect(response.status).toBe(200);
    expect(response.body.granted).toBe(true);
    expect(response.body.policyVersion).toBe('2026-11');

    const fetched = await request(app).get('/api/residents/me/consent').set(authHeader(token));
    expect(fetched.body.granted).toBe(true);
  });

  it('replaces alert preferences', async () => {
    const response = await request(app)
      .put('/api/residents/me/preferences')
      .set(authHeader(token))
      .send([
        { category: 'FIRE', optedIn: false },
        { category: 'FLOOD', optedIn: true }
      ]);
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);

    const fetched = await request(app).get('/api/residents/me/preferences').set(authHeader(token));
    expect(fetched.body).toHaveLength(2);
  });

  it('lists only announcements relevant to the resident barangay', async () => {
    const { admin } = await createAdmin({ role: AdminRole.HIGH_LEVEL });
    await prisma.alert.create({
      data: {
        content: 'Barangay A announcement',
        category: 'FIRE',
        status: AlertStatus.COMPLETED,
        createdByAdminId: admin.id,
        targets: { create: [{ barangayId: barangayA }] }
      }
    });
    await prisma.alert.create({
      data: {
        content: 'Barangay B announcement',
        category: 'FIRE',
        status: AlertStatus.COMPLETED,
        createdByAdminId: admin.id,
        targets: { create: [{ barangayId: barangayB }] }
      }
    });

    const announcements = await request(app)
      .get('/api/residents/me/announcements')
      .set(authHeader(token));
    expect(announcements.status).toBe(200);
    expect(announcements.body).toHaveLength(1);
    expect(announcements.body[0].content).toBe('Barangay A announcement');
  });

  it('rejects resident endpoints without a resident token', async () => {
    const response = await request(app).get('/api/residents/me');
    expect(response.status).toBe(401);
  });
});
