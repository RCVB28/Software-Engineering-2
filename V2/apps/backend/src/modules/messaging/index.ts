import { env, type MessagingProviderName } from '../../config/env';
import { MockProvider, mockProvider } from './mock.provider';
import { TextbeeProvider, missingTextbeeConfig } from './textbee.provider';
import { TwilioProvider, missingTwilioConfig } from './twilio.provider';
import type { MessagingProvider } from './provider';

let provider: MessagingProvider | undefined;

export function getProvider(): MessagingProvider {
  if (provider) return provider;
  if (env.MESSAGING_PROVIDER === 'twilio') provider = new TwilioProvider();
  else if (env.MESSAGING_PROVIDER === 'textbee') provider = new TextbeeProvider();
  else provider = mockProvider;
  return provider;
}

export interface ProviderInfo {
  provider: MessagingProviderName;
  /** False when a real provider is selected but one or more credentials are empty. */
  configured: boolean;
  missing: string[];
  /** Sender number for Twilio; `null` for the mock and textbee providers. */
  fromNumber: string | null;
  /** Sending Android device for textbee; `null` for the mock and Twilio providers. */
  deviceId: string | null;
  maxRetries: number;
  retryDelayMs: number;
}

/** Describes the configured provider without constructing a client or sending anything. */
export function getProviderInfo(): ProviderInfo {
  const selected = env.MESSAGING_PROVIDER;
  const missing =
    selected === 'twilio'
      ? missingTwilioConfig(env)
      : selected === 'textbee'
        ? missingTextbeeConfig(env)
        : [];
  return {
    provider: selected,
    configured: missing.length === 0,
    missing,
    fromNumber: selected === 'twilio' ? env.TWILIO_FROM_NUMBER || null : null,
    deviceId: selected === 'textbee' ? env.TEXTBEE_DEVICE_ID || null : null,
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
