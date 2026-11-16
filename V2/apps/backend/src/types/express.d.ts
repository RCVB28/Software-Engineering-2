import type { Principal } from './auth';

declare global {
  namespace Express {
    interface Request {
      user?: Principal;
    }
  }
}

export {};
