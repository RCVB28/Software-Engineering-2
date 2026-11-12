export type ProviderStatus = 'SUCCESS' | 'FAILURE' | 'DELAYED';

export interface SendResult {
  status: ProviderStatus;
  providerMessageId?: string;
  error?: string;
}

export interface MessagingProvider {
  send(to: string, body: string): Promise<SendResult>;
}
