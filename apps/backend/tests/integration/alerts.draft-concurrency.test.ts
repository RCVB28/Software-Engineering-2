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
import * as recipientService from '../../src/modules/alerts/recipient.service';

describeDb('draft edit concurrency', () => {
  let token: string;
  let barangayA: string;
  let barangayB: string;
  let mock: ReturnType<typeof useMockMessaging>;

  beforeEach(async () => {
    await resetDatabase();
    mock = useMockMessaging();
    const fixture = await createLocality();
    barangayA = fixture.barangays[0].id;
    barangayB = fixture.barangays[1].id;
    token = (await createAdmin({ role: AdminRole.HIGH_LEVEL })).token;
    await createResident({ barangayId: barangayA, phones: ['+639170000011'] });
    await createResident({ barangayId: barangayB, phones: ['+639170000012'] });
  });

  async function createDraft(overrides: Record<string, unknown> = {}) {
    return request(app)
      .post('/api/admin/alerts')
      .set(authHeader(token))
      .send({
        content: 'Initial content',
        category: AlertCategory.FLOOD,
        targets: [{ barangayId: barangayA }],
        ...overrides
      });
  }

  it('keeps the last successful concurrent save when two edits race', async () => {
    const created = await createDraft();
    const path = `/api/admin/alerts/${created.body.id}`;

    const payloads = [
      {
        content: 'Race content A',
        category: AlertCategory.FIRE,
        targets: [{ barangayId: barangayA }]
      },
      {
        content: 'Race content B',
        category: AlertCategory.MEDICAL,
        targets: [{ barangayId: barangayB }]
      }
    ];

    const responses = await Promise.all(
      payloads.map((payload) =>
        request(app).patch(path).set(authHeader(token)).send(payload)
      )
    );

    expect(responses.map((response) => response.status)).toEqual([200, 200]);

    const finalAlert = await prisma.alert.findUniqueOrThrow({
      where: { id: created.body.id },
      include: { targets: true }
    });
    const matches = payloads.filter(
      (payload) =>
        finalAlert.content === payload.content &&
        finalAlert.category === payload.category &&
        finalAlert.targets.length === 1 &&
        finalAlert.targets[0].barangayId === payload.targets[0].barangayId
    );
    expect(matches).toHaveLength(1);
  });

  it('rejects a save that arrives after confirmation', async () => {
    const created = await createDraft();
    await request(app)
      .post(`/api/admin/alerts/${created.body.id}/confirm`)
      .set(authHeader(token));

    const lateSave = await request(app)
      .patch(`/api/admin/alerts/${created.body.id}`)
      .set(authHeader(token))
      .send({ content: 'Too late' });

    expect(lateSave.status).toBe(409);
    expect(lateSave.body.code).toBe('INVALID_STATE');
  });

  it('confirms using the latest committed content and targets', async () => {
    const created = await createDraft();
    await request(app)
      .patch(`/api/admin/alerts/${created.body.id}`)
      .set(authHeader(token))
      .send({
        content: 'Latest committed message',
        category: AlertCategory.FIRE,
        targets: [{ barangayId: barangayB }]
      });

    const confirmed = await request(app)
      .post(`/api/admin/alerts/${created.body.id}/confirm`)
      .set(authHeader(token));

    expect(confirmed.status).toBe(200);
    const records = await prisma.deliveryRecord.findMany({ where: { alertId: created.body.id } });
    expect(records).toHaveLength(1);
    expect(records[0].phoneNumber).toBe('+639170000012');
    expect(mock.sent).toHaveLength(1);
    expect(mock.sent[0].body).toBe('Latest committed message');
  });

  it('blocks saves once confirmation has claimed the draft', async () => {
    const created = await createDraft();
    const originalResolve = recipientService.resolveRecipients.bind(recipientService.resolveRecipients);
    let releaseResolution: () => void = () => undefined;
    const resolutionGate = new Promise<void>((resolve) => {
      releaseResolution = resolve;
    });
    let resolutionStarted: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      resolutionStarted = resolve;
    });

    const spy = jest
      .spyOn(recipientService, 'resolveRecipients')
      .mockImplementation(async (...args) => {
        resolutionStarted();
        await resolutionGate;
        return originalResolve(...args);
      });

    try {
      const confirmation = request(app)
        .post(`/api/admin/alerts/${created.body.id}/confirm`)
        .set(authHeader(token))
        .then((response) => response);
      await started;

      const lateSave = request(app)
        .patch(`/api/admin/alerts/${created.body.id}`)
        .set(authHeader(token))
        .send({ content: 'Saved during confirmation' })
        .then((response) => response);

      await new Promise((resolve) => setTimeout(resolve, 50));
      releaseResolution();
      const [lateSaveResponse, confirmed] = await Promise.all([lateSave, confirmation]);
      expect(lateSaveResponse.status).toBe(409);
      expect(confirmed.status).toBe(200);
      expect(mock.sent).toHaveLength(1);
      expect(mock.sent[0].body).toBe('Initial content');
    } finally {
      releaseResolution();
      spy.mockRestore();
    }
  });

  it('leaves the alert in DRAFT when confirmation finds no eligible recipients', async () => {
    await prisma.consent.updateMany({ data: { granted: false } });
    const created = await createDraft();

    const confirmed = await request(app)
      .post(`/api/admin/alerts/${created.body.id}/confirm`)
      .set(authHeader(token));

    expect(confirmed.status).toBe(400);
    const stored = await prisma.alert.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(stored.status).toBe('DRAFT');
  });
});
