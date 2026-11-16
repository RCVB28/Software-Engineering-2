import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error';

export interface GoogleIdentity {
  subject: string;
  email: string;
  name?: string;
}

const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      throw new AppError(401, 'Google token is missing required claims', 'UNAUTHORIZED');
    }
    return { subject: payload.sub, email: payload.email, name: payload.name };
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error(
      'Google ID token verification failed:',
      error instanceof Error ? error.message : 'unknown error'
    );
    throw new AppError(401, 'Invalid Google ID token', 'UNAUTHORIZED');
  }
}
