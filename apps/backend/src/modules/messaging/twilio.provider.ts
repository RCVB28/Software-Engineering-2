import twilio from 'twilio';
import { env } from '../../config/env';
import type { MessagingProvider, SendResult } from './provider';

export class TwilioProvider implements MessagingProvider {
  private client: ReturnType<typeof twilio>;

  constructor() {
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
      return { status: 'FAILURE', error: error instanceof Error ? error.message : 'Twilio error' };
    }
  }
}
