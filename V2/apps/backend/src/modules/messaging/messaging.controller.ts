import { asyncHandler } from '../../middleware/error';
import { normalizePhone, optionalString } from '../../middleware/validation';
import { getProvider, getProviderInfo } from './index';

const DEFAULT_TEST_BODY = 'LEARW test message: SMS delivery is working.';

/** Reports which provider is active and whether its credentials are complete (no secrets). */
export const getMessagingStatusHandler = asyncHandler(async (_req, res) => {
  res.json(getProviderInfo());
});

/**
 * Sends a single one-off message through the active provider. With `MESSAGING_PROVIDER=twilio` or
 * `textbee` this is the endpoint to exercise the real API from Postman; with the mock provider it is
 * a safe, free dry run.
 */
export const sendTestMessageHandler = asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  const to = normalizePhone(body.to ?? body.number);
  const message = optionalString(body.body, 'body', 480) ?? DEFAULT_TEST_BODY;
  const provider = getProvider();
  const result = await provider.send(to, message);
  res.json({ provider: provider.name, to, body: message, result });
});
