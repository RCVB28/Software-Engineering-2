import type { NextFunction, Request, RequestHandler, Response } from 'express';

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: string[]
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ message: 'Resource not found', code: 'NOT_FOUND' });
};

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.status).json({ message: err.message, code: err.code, details: err.details });
    return;
  }
  const message = err instanceof Error ? err.message : 'Unexpected error';
  if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.error(message);
  }
  res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
};
