import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';

export interface TokenPayload {
  sub: string;
  kind: 'ADMIN' | 'RESIDENT';
  role: string;
  barangayId?: string | null;
  email?: string;
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN
  } as SignOptions);
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}
