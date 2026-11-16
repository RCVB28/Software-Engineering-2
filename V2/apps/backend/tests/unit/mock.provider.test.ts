import { MockProvider } from '../../src/modules/messaging/mock.provider';

describe('MockProvider', () => {
  it('records successful sends and returns a message id', async () => {
    const provider = new MockProvider(0);
    const result = await provider.send('+639170000001', 'hello');
    expect(result.status).toBe('SUCCESS');
    expect(result.providerMessageId).toMatch(/^mock-/);
    expect(provider.sent).toEqual([{ to: '+639170000001', body: 'hello' }]);
  });

  it('fails a configured number of times before succeeding', async () => {
    const provider = new MockProvider(2);
    expect((await provider.send('+639170000001', 'a')).status).toBe('FAILURE');
    expect((await provider.send('+639170000001', 'a')).status).toBe('FAILURE');
    expect((await provider.send('+639170000001', 'a')).status).toBe('SUCCESS');
  });
});
