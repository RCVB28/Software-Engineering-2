import { Prisma } from '@prisma/client';
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

/** Maps common Prisma request errors to meaningful HTTP responses instead of a generic 500. */
function mapPrismaError(error: Prisma.PrismaClientKnownRequestError): AppError | undefined {
  switch (error.code) {
    case 'P2002':
      return new AppError(409, 'A record with these values already exists', 'DUPLICATE');
    case 'P2003':
      return new AppError(400, 'Referenced record does not exist', 'VALIDATION_ERROR');
    case 'P2025':
      return new AppError(404, 'Record not found', 'NOT_FOUND');
    default:
      return undefined;
  }
}

/**
 * Reads the HTTP status that framework middleware (e.g. `express.json`) attaches to its errors so
 * malformed bodies and oversized payloads return 4xx instead of a misleading 500.
 */
function frameworkStatus(error: unknown): number | undefined {
  const candidate = error as { status?: unknown; statusCode?: unknown };
  if (typeof candidate?.status === 'number') return candidate.status;
  if (typeof candidate?.statusCode === 'number') return candidate.statusCode;
  return undefined;
}

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

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = mapPrismaError(err);
    if (mapped) {
      res.status(mapped.status).json({ message: mapped.message, code: mapped.code });
      return;
    }
  }

  const status = frameworkStatus(err);
  if (status !== undefined && status >= 400 && status < 500) {
    const expose = (err as { expose?: unknown }).expose === true;
    const message = expose && err instanceof Error ? err.message : 'Invalid request';
    res.status(status).json({ message, code: 'BAD_REQUEST' });
    return;
  }

  const message = err instanceof Error ? err.message : 'Unexpected error';
  if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.error(message);
  }
  res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
};
