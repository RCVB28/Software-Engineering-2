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
import { useMockMessaging } from '../helpers/messaging';

describeDb('alert endpoints contract', () => {
  let highToken: string;
  let lowToken: string;
  let barangayA: string;
  let barangayB: string;
  let mock: ReturnType<typeof useMockMessaging>;

  beforeEach(async () => {
    await resetDatabase();
    mock = useMockMessaging();
    const fixture = await createLocality();
    barangayA = fixture.barangays[0].id;
    barangayB = fixture.barangays[1].id;
    highToken = (await createAdmin({ role: AdminRole.HIGH_LEVEL })).token;
    lowToken = (await createAdmin({ role: AdminRole.LOW_LEVEL, barangayId: barangayA })).token;
    await createResident({ barangayId: barangayA });
    await createResident({ barangayId: barangayB });
  });

  async function createDraft(overrides: Record<string, unknown> = {}) {
    return request(app)
      .post('/api/admin/alerts')
      .set(authHeader(highToken))
      .send({
        content: 'Evacuate immediately',
        category: AlertCategory.FLOOD,
        targets: [{ barangayId: barangayA }],
        ...overrides
      });
  }

  it('creates a draft alert with targets', async () => {
    const response = await createDraft();
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('DRAFT');
    expect(response.body.targets).toHaveLength(1);
  });

  it('lists alerts and previews recipients for a target', async () => {
    const created = await createDraft();
    const list = await request(app).get('/api/admin/alerts').set(authHeader(highToken));
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);

    const preview = await request(app)
      .get(`/api/admin/alerts/${created.body.id}/recipients`)
      .set(authHeader(highToken));
    expect(preview.status).toBe(200);
    expect(preview.body.count).toBe(1);
    expect(preview.body.recipients[0].barangayId).toBe(barangayA);
  });

  it('confirms an alert, dispatches messages, and records deliveries', async () => {
    const created = await createDraft();
    const confirmed = await request(app)
      .post(`/api/admin/alerts/${created.body.id}/confirm`)
      .set(authHeader(highToken));

    expect(confirmed.status).toBe(200);
    expect(confirmed.body.status).toBe('COMPLETED');
    expect(confirmed.body.confirmedAt).not.toBeNull();
    expect(mock.sent).toHaveLength(1);

    const deliveries = await request(app)
      .get(`/api/admin/alerts/${created.body.id}/deliveries`)
      .set(authHeader(highToken));
    expect(deliveries.status).toBe(200);
    expect(deliveries.body).toHaveLength(1);
    expect(deliveries.body[0].status).toBe('SUCCESS');
  });

  it('rejects confirming an already confirmed alert', async () => {
    const created = await createDraft();
    await request(app).post(`/api/admin/alerts/${created.body.id}/confirm`).set(authHeader(highToken));
    const second = await request(app)
      .post(`/api/admin/alerts/${created.body.id}/confirm`)
      .set(authHeader(highToken));
    expect(second.status).toBe(409);
  });

  it('rejects an alert with no targets', async () => {
    const response = await createDraft({ targets: [] });
    expect(response.status).toBe(400);
  });

  it('blocks low-level admins from targeting another barangay', async () => {
    const response = await request(app)
      .post('/api/admin/alerts')
      .set(authHeader(lowToken))
      .send({
        content: 'Stay safe',
        category: AlertCategory.FIRE,
        targets: [{ barangayId: barangayB }]
      });
    expect(response.status).toBe(403);
  });

  it('rejects unauthenticated access', async () => {
    const response = await request(app).get('/api/admin/alerts');
    expect(response.status).toBe(401);
  });

  it('rejects confirmation when no eligible recipients exist', async () => {
    await prisma.consent.updateMany({ data: { granted: false } });
    const created = await createDraft();
    const confirmed = await request(app)
      .post(`/api/admin/alerts/${created.body.id}/confirm`)
      .set(authHeader(highToken));
    expect(confirmed.status).toBe(400);
    expect(mock.sent).toHaveLength(0);
  });
});
