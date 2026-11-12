import { env } from '../../config/env';
import { MockProvider, mockProvider } from './mock.provider';
import { TwilioProvider } from './twilio.provider';
import type { MessagingProvider } from './provider';

let provider: MessagingProvider | undefined;

export function getProvider(): MessagingProvider {
  if (provider) return provider;
  provider = env.MESSAGING_PROVIDER === 'twilio' ? new TwilioProvider() : mockProvider;
  return provider;
}

export function setProviderForTests(next: MessagingProvider): void {
  provider = next;
}

export function resetProviderForTests(): void {
  provider = new MockProvider(0);
}

export { MockProvider, mockProvider };
