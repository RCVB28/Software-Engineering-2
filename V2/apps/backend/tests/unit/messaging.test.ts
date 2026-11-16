import request from 'supertest';
import { app } from '../../src/app';
import { signAccessToken } from '../../src/modules/auth/token';
import { resetProviderForTests, setProviderForTests } from '../../src/modules/messaging';
import { MockProvider } from '../../src/modules/messaging/mock.provider';
import { TwilioProvider, missingTwilioConfig } from '../../src/modules/messaging/twilio.provider';

function adminToken(role: string): string {
  return signAccessToken({
    sub: `admin-${role}`,
    kind: 'ADMIN',
    role,
    email: `${role.toLowerCase()}@example.com`
  });
}

describe('messaging admin endpoints', () => {
  let provider: MockProvider;

  beforeEach(() => {
    provider = new MockProvider(0);
    setProviderForTests(provider);
  });

  afterEach(() => {
    resetProviderForTests();
  });

  it('reports the active provider and configuration status', async () => {
    const response = await request(app)
      .get('/api/admin/messaging/status')
      .set('Authorization', `Bearer ${adminToken('HIGH_LEVEL')}`);

    expect(response.status).toBe(200);
    expect(response.body.provider).toBe('mock');
    expect(response.body.configured).toBe(true);
    expect(response.body.missing).toEqual([]);
  });

  it('requires authentication for the status endpoint', async () => {
    const response = await request(app).get('/api/admin/messaging/status');
    expect(response.status).toBe(401);
  });

  it('sends a normalized test message through the active provider', async () => {
    const response = await request(app)
      .post('/api/admin/messaging/test')
      .set('Authorization', `Bearer ${adminToken('SUPERADMIN')}`)
      .send({ to: '+63 (917) 000-0001', body: 'ping' });

    expect(response.status).toBe(200);
    expect(response.body.provider).toBe('mock');
    expect(response.body.to).toBe('+639170000001');
    expect(response.body.result.status).toBe('SUCCESS');
    expect(provider.sent).toEqual([{ to: '+639170000001', body: 'ping' }]);
  });

  it('rejects an invalid destination number', async () => {
    const response = await request(app)
      .post('/api/admin/messaging/test')
      .set('Authorization', `Bearer ${adminToken('SUPERADMIN')}`)
      .send({ to: 'not-a-phone' });

    expect(response.status).toBe(400);
    expect(provider.sent).toHaveLength(0);
  });

  it('restricts test sends to superadmins', async () => {
    const response = await request(app)
      .post('/api/admin/messaging/test')
      .set('Authorization', `Bearer ${adminToken('HIGH_LEVEL')}`)
      .send({ to: '+639170000001' });

    expect(response.status).toBe(403);
    expect(provider.sent).toHaveLength(0);
  });
});

describe('TwilioProvider configuration', () => {
  it('reports every missing credential', () => {
    expect(
      missingTwilioConfig({
        TWILIO_ACCOUNT_SID: '',
        TWILIO_AUTH_TOKEN: '',
        TWILIO_FROM_NUMBER: ''
      })
    ).toEqual(['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER']);
  });

  it('fails fast with a clear error when credentials are absent', () => {
    expect(() => new TwilioProvider()).toThrow(/MESSAGING_PROVIDER=twilio requires/);
  });
});
