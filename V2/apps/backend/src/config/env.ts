import dotenv from 'dotenv';

dotenv.config();

export type MessagingProviderName = 'mock' | 'twilio';

/**
 * Normalizes `MESSAGING_PROVIDER` (trim + lowercase) and fails fast on an unknown value so a typo
 * never silently falls back to the mock provider.
 */
function parseMessagingProvider(value: string | undefined): MessagingProviderName {
  const normalized = (value ?? 'mock').trim().toLowerCase();
  if (normalized === 'mock' || normalized === 'twilio') return normalized;
  throw new Error(`MESSAGING_PROVIDER must be "mock" or "twilio" (received "${value ?? ''}")`);
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number.parseInt(process.env.PORT ?? '4000', 10),
  DATABASE_URL:
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/se2?schema=public',
  JWT_SECRET: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '1h',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? '',
  MESSAGING_PROVIDER: parseMessagingProvider(process.env.MESSAGING_PROVIDER),
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ?? '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ?? '',
  TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER ?? '',
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  MESSAGING_MAX_RETRIES: Number.parseInt(process.env.MESSAGING_MAX_RETRIES ?? '3', 10),
  MESSAGING_RETRY_DELAY_MS: Number.parseInt(process.env.MESSAGING_RETRY_DELAY_MS ?? '200', 10),
  MESSAGING_MOCK_FAILURES: Number.parseInt(process.env.MESSAGING_MOCK_FAILURES ?? '0', 10)
};
