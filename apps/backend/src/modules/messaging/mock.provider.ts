import { randomUUID } from 'node:crypto';
import type { MessagingProvider, SendResult } from './provider';

export class MockProvider implements MessagingProvider {
  public sent: Array<{ to: string; body: string }> = [];
  private failuresRemaining: number;

  constructor(failures = 0) {
    this.failuresRemaining = failures;
  }

  setFailures(count: number): void {
    this.failuresRemaining = count;
  }

  async send(to: string, body: string): Promise<SendResult> {
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      return { status: 'FAILURE', error: 'Simulated provider failure' };
    }
    this.sent.push({ to, body });
    return { status: 'SUCCESS', providerMessageId: `mock-${randomUUID()}` };
  }
}

export const mockProvider = new MockProvider(Number(process.env.MESSAGING_MOCK_FAILURES ?? '0'));
