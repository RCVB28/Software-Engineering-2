import { AlertStatus, DeliveryStatus, PrismaClient } from '@prisma/client';
import { env } from '../../config/env';
import type { MessagingProvider, SendResult } from './provider';

export interface DispatchRecipient {
  residentId: string;
  phoneNumbers: string[];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sends an alert to every recipient phone number, retrying failures a bounded number of times and
 * using a deterministic idempotency key so retries never create duplicate messages or records.
 */
export async function dispatchAlert(
  prisma: PrismaClient,
  provider: MessagingProvider,
  alertId: string,
  content: string,
  recipients: DispatchRecipient[]
): Promise<void> {
  await prisma.alert.update({ where: { id: alertId }, data: { status: AlertStatus.SENDING } });

  for (const recipient of recipients) {
    for (const phone of recipient.phoneNumbers) {
      const idempotencyKey = `${alertId}:${recipient.residentId}:${phone}`;
      const existing = await prisma.deliveryRecord.findUnique({ where: { idempotencyKey } });
      if (existing?.status === DeliveryStatus.SUCCESS) continue;

      const record =
        existing ??
        (await prisma.deliveryRecord.create({
          data: {
            alertId,
            residentId: recipient.residentId,
            phoneNumber: phone,
            idempotencyKey,
            status: DeliveryStatus.SUBMITTED
          }
        }));

      const maxAttempts = Math.max(1, env.MESSAGING_MAX_RETRIES);
      let result: SendResult | undefined;
      let attempts = 0;
      for (let i = 0; i < maxAttempts; i += 1) {
        attempts += 1;
        try {
          result = await provider.send(phone, content);
        } catch (error) {
          // A provider must never crash the whole dispatch; record the failure and retry.
          result = {
            status: 'FAILURE',
            error: error instanceof Error ? error.message : 'Provider error'
          };
        }
        if (result.status === 'SUCCESS') break;
        if (i < maxAttempts - 1) await delay(env.MESSAGING_RETRY_DELAY_MS);
      }

      const status =
        result?.status === 'SUCCESS'
          ? DeliveryStatus.SUCCESS
          : result?.status === 'DELAYED'
            ? DeliveryStatus.DELAYED
            : DeliveryStatus.FAILURE;

      await prisma.deliveryRecord.update({
        where: { id: record.id },
        data: {
          status,
          attempts,
          providerMessageId: result?.providerMessageId ?? null,
          lastError: result?.error ?? null
        }
      });
    }
  }

  await prisma.alert.update({ where: { id: alertId }, data: { status: AlertStatus.COMPLETED } });
}
