import { MockProvider } from '../../src/modules/messaging/mock.provider';
import { resetProviderForTests, setProviderForTests } from '../../src/modules/messaging';

export function useMockMessaging(failures = 0): MockProvider {
  const provider = new MockProvider(failures);
  setProviderForTests(provider);
  return provider;
}

export { resetProviderForTests };
