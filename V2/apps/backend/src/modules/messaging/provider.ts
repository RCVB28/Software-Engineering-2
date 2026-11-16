export type ProviderStatus = 'SUCCESS' | 'FAILURE' | 'DELAYED';

export interface SendResult {
  status: ProviderStatus;
  providerMessageId?: string;
  error?: string;
}

export interface MessagingProvider {
  /** Stable identifier for the active provider (e.g. `mock`, `twilio`). */
  readonly name: string;
  send(to: string, body: string): Promise<SendResult>;
}
