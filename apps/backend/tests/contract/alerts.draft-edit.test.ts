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

describeDb('draft edit contract', () => {
  let highToken: string;
  let lowToken: string;
  let barangayA: string;
  let barangayB: string;

  beforeEach(async () => {
    await resetDatabase();
    useMockMessaging();
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
        content: 'Original message',
        category: AlertCategory.FLOOD,
        targets: [{ barangayId: barangayA }],
        ...overrides
      });
  }

  it('reopens a saved draft with its persisted values', async () => {
    const created = await createDraft({
      content: 'Saved draft',
      category: AlertCategory.FIRE,
      targets: [{ barangayId: barangayA, residentRole: 'RESIDENT' }]
    });

    const reopened = await request(app)
      .get(`/api/admin/alerts/${created.body.id}`)
      .set(authHeader(highToken));

    expect(reopened.status).toBe(200);
    expect(reopened.body.content).toBe('Saved draft');
    expect(reopened.body.category).toBe('FIRE');
    expect(reopened.body.targets).toEqual([
      expect.objectContaining({ barangayId: barangayA, residentRole: 'RESIDENT' })
    ]);
  });

  it('persists content, category, and targets through PATCH', async () => {
    const created = await createDraft();

    const updated = await request(app)
      .patch(`/api/admin/alerts/${created.body.id}`)
      .set(authHeader(highToken))
      .send({
        content: 'Updated message',
        category: AlertCategory.MEDICAL,
        targets: [{ barangayId: barangayB }]
      });

    expect(updated.status).toBe(200);
    expect(updated.body.content).toBe('Updated message');
    expect(updated.body.category).toBe('MEDICAL');
    expect(updated.body.targets).toHaveLength(1);
    expect(updated.body.targets[0].barangayId).toBe(barangayB);

    const reloaded = await request(app)
      .get(`/api/admin/alerts/${created.body.id}`)
      .set(authHeader(highToken));
    expect(reloaded.body.content).toBe('Updated message');
    expect(reloaded.body.category).toBe('MEDICAL');
    expect(reloaded.body.targets[0].barangayId).toBe(barangayB);
  });

  it('previews recipients using the latest saved targets', async () => {
    const created = await createDraft();

    await request(app)
      .patch(`/api/admin/alerts/${created.body.id}`)
      .set(authHeader(highToken))
      .send({ targets: [{ barangayId: barangayB }] });

    const preview = await request(app)
      .get(`/api/admin/alerts/${created.body.id}/recipients`)
      .set(authHeader(highToken));

    expect(preview.status).toBe(200);
    expect(preview.body.count).toBe(1);
    expect(preview.body.recipients[0].barangayId).toBe(barangayB);
  });

  it('rejects edits after confirmation and leaves the alert unchanged', async () => {
    const created = await createDraft();
    const confirmed = await request(app)
      .post(`/api/admin/alerts/${created.body.id}/confirm`)
      .set(authHeader(highToken));
    expect(confirmed.status).toBe(200);

    const before = await prisma.alert.findUniqueOrThrow({ where: { id: created.body.id } });
    const rejected = await request(app)
      .patch(`/api/admin/alerts/${created.body.id}`)
      .set(authHeader(highToken))
      .send({ content: 'Mutation after send' });

    expect(rejected.status).toBe(409);
    expect(rejected.body.code).toBe('INVALID_STATE');

    const after = await prisma.alert.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(after.content).toBe(before.content);
    expect(after.category).toBe(before.category);
    expect(after.status).toBe(before.status);
  });

  it('rejects content over 480 characters and invalid or empty targets', async () => {
    const created = await createDraft();
    const path = `/api/admin/alerts/${created.body.id}`;

    const longContent = await request(app)
      .patch(path)
      .set(authHeader(highToken))
      .send({ content: 'x'.repeat(481) });
    expect(longContent.status).toBe(400);

    const emptyTargets = await request(app)
      .patch(path)
      .set(authHeader(highToken))
      .send({ targets: [] });
    expect(emptyTargets.status).toBe(400);

    const invalidTarget = await request(app)
      .patch(path)
      .set(authHeader(highToken))
      .send({ targets: [{}] });
    expect(invalidTarget.status).toBe(400);
  });

  it('blocks a low-level admin from editing a draft outside their barangay', async () => {
    const created = await createDraft({ targets: [{ barangayId: barangayB }] });

    const response = await request(app)
      .patch(`/api/admin/alerts/${created.body.id}`)
      .set(authHeader(lowToken))
      .send({ content: 'Out of scope edit' });

    expect(response.status).toBe(403);
    const stored = await prisma.alert.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(stored.content).toBe('Original message');
  });
});
