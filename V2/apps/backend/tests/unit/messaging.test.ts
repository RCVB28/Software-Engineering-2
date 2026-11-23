import request from 'supertest';
import { app } from '../../src/app';
import { signAccessToken } from '../../src/modules/auth/token';
import { resetProviderForTests, setProviderForTests } from '../../src/modules/messaging';
import { MockProvider } from '../../src/modules/messaging/mock.provider';
import { TextbeeProvider, missingTextbeeConfig } from '../../src/modules/messaging/textbee.provider';
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

describe('TextbeeProvider', () => {
  const config = { TEXTBEE_API_KEY: 'tb-key', TEXTBEE_DEVICE_ID: '', TEXTBEE_BASE_URL: '' };

  it('reports the missing API key', () => {
    expect(missingTextbeeConfig({ TEXTBEE_API_KEY: '' })).toEqual(['TEXTBEE_API_KEY']);
  });

  it('fails fast with a clear error when the API key is absent', () => {
    expect(() => new TextbeeProvider()).toThrow(/MESSAGING_PROVIDER=textbee requires/);
  });

  it('sends through the textbee API and returns the batch id', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify({ data: { success: true, smsBatchId: 'batch-1' } })
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await new TextbeeProvider(config).send('+639170000001', 'ping');

    expect(result).toEqual({ status: 'SUCCESS', providerMessageId: 'batch-1' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.textbee.dev/api/v1/gateway/send-sms',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': 'tb-key' }
      })
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body).toEqual({ message: 'ping', recipients: ['+639170000001'] });
  });

  it('surfaces the textbee error message and status code on failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => JSON.stringify({ error: 'Invalid API key' })
    }) as unknown as typeof fetch;

    const result = await new TextbeeProvider(config).send('+639170000001', 'ping');

    expect(result.status).toBe('FAILURE');
    expect(result.error).toContain('Invalid API key');
    expect(result.error).toContain('401');
  });

  it('reports a network error as a failure instead of throwing', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const result = await new TextbeeProvider(config).send('+639170000001', 'ping');

    expect(result).toEqual({ status: 'FAILURE', error: 'network down' });
  });
});
