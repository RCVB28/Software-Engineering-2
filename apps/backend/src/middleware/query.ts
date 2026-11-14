import { AppError } from './error';
import { optionalEnum } from './validation';

const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 200;

function validationError(message: string): AppError {
  return new AppError(400, message, 'VALIDATION_ERROR');
}

function parseInteger(value: unknown, field: string): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw validationError(`${field} must be an integer`);
  }
  if (!/^\d+$/.test(String(value))) {
    throw validationError(`${field} must be an integer`);
  }
  return Number(value);
}

export function parsePage(value: unknown): number {
  const page = parseInteger(value, 'page');
  if (page === null) return 1;
  if (page < 1) throw validationError('page must be greater than or equal to 1');
  return page;
}

export function parsePageSize(value: unknown): number {
  const pageSize = parseInteger(value, 'pageSize');
  if (pageSize === null) return 20;
  if (pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw validationError(`pageSize must be between 1 and ${MAX_PAGE_SIZE}`);
  }
  return pageSize;
}

export function parseOptionalEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string
): T | null {
  return optionalEnum(value, allowed, field);
}

export function parseOptionalInstant(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw validationError(`${field} must be an ISO timestamp`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw validationError(`${field} must be a valid ISO timestamp`);
  }
  return date;
}

export function parseDateRange(
  fromValue: unknown,
  toValue: unknown
): { from: Date | null; to: Date | null } {
  const from = parseOptionalInstant(fromValue, 'from');
  const to = parseOptionalInstant(toValue, 'to');
  if (from && to && from.getTime() > to.getTime()) {
    throw validationError('from must be before or equal to to');
  }
  return { from, to };
}

export function parseBoolean(value: unknown, field: string, defaultValue = false): boolean {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw validationError(`${field} must be true or false`);
}

export function parseSearch(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw validationError('q must be a string');
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_SEARCH_LENGTH) {
    throw validationError(`q must be at most ${MAX_SEARCH_LENGTH} characters`);
  }
  return trimmed;
}

export function resolvePagination(
  requestedPage: number,
  pageSize: number,
  total: number
): { page: number; pageSize: number; total: number; totalPages: number; pageAdjusted: boolean } {
  const totalPages = Math.ceil(total / pageSize);
  const page = total === 0 ? 1 : Math.min(requestedPage, totalPages);
  return {
    page,
    pageSize,
    total,
    totalPages,
    pageAdjusted: total > 0 && page !== requestedPage
  };
}
