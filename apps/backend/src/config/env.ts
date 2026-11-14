import dotenv from 'dotenv';

dotenv.config();

export type MessagingProviderName = 'mock' | 'twilio';

function parseDurationMs(value: string | undefined, fallback: number, minimum: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < minimum) return fallback;
  return parsed;
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
  MESSAGING_PROVIDER: (process.env.MESSAGING_PROVIDER ?? 'mock') as MessagingProviderName,
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ?? '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ?? '',
  TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER ?? '',
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  MESSAGING_MAX_RETRIES: Number.parseInt(process.env.MESSAGING_MAX_RETRIES ?? '3', 10),
  MESSAGING_RETRY_DELAY_MS: Number.parseInt(process.env.MESSAGING_RETRY_DELAY_MS ?? '200', 10),
  AUDIT_RETENTION_INTERVAL_MS: parseDurationMs(
    process.env.AUDIT_RETENTION_INTERVAL_MS,
    24 * 60 * 60 * 1000,
    60_000
  ),
  AUDIT_RETENTION_STARTUP_DELAY_MS: parseDurationMs(
    process.env.AUDIT_RETENTION_STARTUP_DELAY_MS,
    5000,
    0
  )
};
