import request from 'supertest';
import { AdminRole, AlertCategory } from '@prisma/client';
import { app } from '../../src/app';
import {
  authHeader,
  createAdmin,
  createLocality,
  createResident,
  describeDb,
  resetDatabase
} from '../helpers/db';
import { useMockMessaging } from '../helpers/messaging';

describeDb('alert broadcast integration', () => {
  async function setup(providerFailures = 0) {
    await resetDatabase();
    const mock = useMockMessaging(providerFailures);
    const fixture = await createLocality();
    const barangayA = fixture.barangays[0].id;
    const barangayB = fixture.barangays[1].id;
    const highToken = (await createAdmin({ role: AdminRole.HIGH_LEVEL })).token;

    await createResident({ barangayId: barangayA, phones: ['+639170000001'] });
    await createResident({ barangayId: barangayA, phones: ['+639170000002'] });
    await createResident({ barangayId: barangayA, consent: false, phones: ['+639170000003'] });
    await createResident({
      barangayId: barangayA,
      phones: ['+639170000004'],
      optedOut: [AlertCategory.FIRE]
    });
    await createResident({ barangayId: barangayB, phones: ['+639170000005'] });

    return { mock, barangayA, barangayB, highToken };
  }

  it('previews only eligible residents for the targeted barangay', async () => {
    const { barangayA, highToken } = await setup();
    const created = await request(app)
      .post('/api/admin/alerts')
      .set(authHeader(highToken))
      .send({
        content: 'Typhoon signal number 3',
        category: AlertCategory.FLOOD,
        targets: [{ barangayId: barangayA }]
      });

    const preview = await request(app)
      .get(`/api/admin/alerts/${created.body.id}/recipients`)
      .set(authHeader(highToken));

    expect(preview.body.count).toBe(3);
    expect(preview.body.recipients.every((r: any) => r.barangayId === barangayA)).toBe(true);
  });

  it('broadcasts once per eligible phone even when the provider fails first', async () => {
    const { mock, barangayA, highToken } = await setup(1);
    const created = await request(app)
      .post('/api/admin/alerts')
      .set(authHeader(highToken))
      .send({
        content: 'Fire at the market',
        category: AlertCategory.FIRE,
        targets: [{ barangayId: barangayA }]
      });

    const confirmed = await request(app)
      .post(`/api/admin/alerts/${created.body.id}/confirm`)
      .set(authHeader(highToken));

    expect(confirmed.status).toBe(200);
    expect(mock.sent).toHaveLength(2);

    const deliveries = await request(app)
      .get(`/api/admin/alerts/${created.body.id}/deliveries`)
      .set(authHeader(highToken));
    expect(deliveries.body.filter((d: any) => d.status === 'SUCCESS')).toHaveLength(2);
  });

  it('rejects broadcasting when the target has no eligible recipients', async () => {
    await resetDatabase();
    const mock = useMockMessaging();
    const fixture = await createLocality();
    const emptyBarangay = fixture.barangays[0].id;
    const token = (await createAdmin({ role: AdminRole.HIGH_LEVEL })).token;

    const created = await request(app)
      .post('/api/admin/alerts')
      .set(authHeader(token))
      .send({
        content: 'No one can receive this',
        category: AlertCategory.OTHER,
        targets: [{ barangayId: emptyBarangay }]
      });

    const confirmed = await request(app)
      .post(`/api/admin/alerts/${created.body.id}/confirm`)
      .set(authHeader(token));

    expect(confirmed.status).toBe(400);
    expect(mock.sent).toHaveLength(0);
  });
});
