import { env } from '../../config/env';
import { MockProvider, mockProvider } from './mock.provider';
import { TwilioProvider, missingTwilioConfig } from './twilio.provider';
import type { MessagingProvider } from './provider';

let provider: MessagingProvider | undefined;

export function getProvider(): MessagingProvider {
  if (provider) return provider;
  provider = env.MESSAGING_PROVIDER === 'twilio' ? new TwilioProvider() : mockProvider;
  return provider;
}

export interface ProviderInfo {
  provider: 'mock' | 'twilio';
  /** False when `twilio` is selected but one or more credentials are empty. */
  configured: boolean;
  missing: string[];
  fromNumber: string | null;
  maxRetries: number;
  retryDelayMs: number;
}

/** Describes the configured provider without constructing a client or sending anything. */
export function getProviderInfo(): ProviderInfo {
  const isTwilio = env.MESSAGING_PROVIDER === 'twilio';
  const missing = isTwilio ? missingTwilioConfig(env) : [];
  return {
    provider: env.MESSAGING_PROVIDER,
    configured: missing.length === 0,
    missing,
    fromNumber: isTwilio ? env.TWILIO_FROM_NUMBER || null : null,
    maxRetries: env.MESSAGING_MAX_RETRIES,
    retryDelayMs: env.MESSAGING_RETRY_DELAY_MS
  };
}

export function setProviderForTests(next: MessagingProvider): void {
  provider = next;
}

export function resetProviderForTests(): void {
  provider = new MockProvider(0);
}

export { MockProvider, mockProvider };
