import twilio from 'twilio';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error';
import type { MessagingProvider, SendResult } from './provider';

const REQUIRED_TWILIO_VARS = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_FROM_NUMBER'
] as const;

export type TwilioConfigKey = (typeof REQUIRED_TWILIO_VARS)[number];

/** Returns the Twilio environment variables that are still empty. */
export function missingTwilioConfig(config: {
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_FROM_NUMBER: string;
}): TwilioConfigKey[] {
  return REQUIRED_TWILIO_VARS.filter((key) => !config[key]);
}

export class TwilioProvider implements MessagingProvider {
  public readonly name = 'twilio';
  private client: ReturnType<typeof twilio>;

  constructor() {
    const missing = missingTwilioConfig(env);
    if (missing.length > 0) {
      throw new AppError(
        500,
        `MESSAGING_PROVIDER=twilio requires ${missing.join(', ')} to be set`,
        'MESSAGING_NOT_CONFIGURED'
      );
    }
    this.client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  }

  async send(to: string, body: string): Promise<SendResult> {
    try {
      const message = await this.client.messages.create({
        to,
        from: env.TWILIO_FROM_NUMBER,
        body
      });
      return { status: 'SUCCESS', providerMessageId: message.sid };
    } catch (error) {
      const base = error instanceof Error ? error.message : 'Twilio error';
      const code = (error as { code?: number | string } | null)?.code;
      return { status: 'FAILURE', error: code ? `${base} (Twilio code ${code})` : base };
    }
  }
}
