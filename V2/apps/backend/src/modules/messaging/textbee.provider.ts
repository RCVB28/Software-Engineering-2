import { env } from '../../config/env';
import { AppError } from '../../middleware/error';
import type { MessagingProvider, SendResult } from './provider';

/** Public textbee API. Self-hosted instances override this with `TEXTBEE_BASE_URL`. */
const DEFAULT_BASE_URL = 'https://api.textbee.dev/api/v1';

const REQUIRED_TEXTBEE_VARS = ['TEXTBEE_API_KEY'] as const;

export type TextbeeConfigKey = (typeof REQUIRED_TEXTBEE_VARS)[number];

export interface TextbeeConfig {
  TEXTBEE_API_KEY: string;
  /** Optional: the Android device that sends. Omit to use the account default. */
  TEXTBEE_DEVICE_ID: string;
  /** Optional: override the API base URL (e.g. a self-hosted textbee instance). */
  TEXTBEE_BASE_URL: string;
}

/** Returns the textbee environment variables that are still empty. */
export function missingTextbeeConfig(config: Pick<TextbeeConfig, 'TEXTBEE_API_KEY'>): TextbeeConfigKey[] {
  return REQUIRED_TEXTBEE_VARS.filter((key) => !config[key]);
}

function textbeeConfigFromEnv(): TextbeeConfig {
  return {
    TEXTBEE_API_KEY: env.TEXTBEE_API_KEY,
    TEXTBEE_DEVICE_ID: env.TEXTBEE_DEVICE_ID,
    TEXTBEE_BASE_URL: env.TEXTBEE_BASE_URL
  };
}

interface TextbeeSendResponse {
  data?: {
    success?: boolean;
    message?: string;
    smsBatchId?: string;
    recipientCount?: number;
  };
  /** Present on 400/401/403 responses. */
  error?: string;
  /** Present on 429 responses and some errors. */
  message?: string;
}

function parseJson(text: string): TextbeeSendResponse {
  if (!text) return {};
  try {
    return JSON.parse(text) as TextbeeSendResponse;
  } catch {
    return {};
  }
}

/**
 * Sends SMS through textbee.dev, an SMS gateway that pushes messages to an Android phone you own
 * (the phone sends them via its own SIM). Unlike Twilio there is no sender number to configure —
 * the sending device is the "from".
 */
export class TextbeeProvider implements MessagingProvider {
  public readonly name = 'textbee';
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly deviceId: string | undefined;

  constructor(config: TextbeeConfig = textbeeConfigFromEnv()) {
    const missing = missingTextbeeConfig(config);
    if (missing.length > 0) {
      throw new AppError(
        500,
        `MESSAGING_PROVIDER=textbee requires ${missing.join(', ')} to be set`,
        'MESSAGING_NOT_CONFIGURED'
      );
    }
    this.apiKey = config.TEXTBEE_API_KEY;
    this.deviceId = config.TEXTBEE_DEVICE_ID || undefined;
    this.baseUrl = (config.TEXTBEE_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  }

  async send(to: string, body: string): Promise<SendResult> {
    const payload: { message: string; recipients: string[]; deviceId?: string } = {
      message: body,
      recipients: [to]
    };
    if (this.deviceId) payload.deviceId = this.deviceId;

    try {
      const response = await fetch(`${this.baseUrl}/gateway/send-sms`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey },
        body: JSON.stringify(payload)
      });
      const parsed = parseJson(await response.text());

      if (!response.ok) {
        const reason = parsed.error ?? parsed.message ?? response.statusText ?? 'request failed';
        return { status: 'FAILURE', error: `textbee: ${reason} (HTTP ${response.status})` };
      }
      if (parsed.data?.success === false) {
        return {
          status: 'FAILURE',
          error: `textbee: ${parsed.data.message ?? 'send rejected'}`
        };
      }
      return { status: 'SUCCESS', providerMessageId: parsed.data?.smsBatchId };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'textbee error';
      return { status: 'FAILURE', error: message };
    }
  }
}
