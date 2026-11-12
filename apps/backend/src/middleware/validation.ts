import { AppError } from './error';

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new AppError(400, message, 'VALIDATION_ERROR');
}

export function ensureObject(value: unknown): Record<string, unknown> {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), 'Expected an object');
  return value as Record<string, unknown>;
}

export function requireString(value: unknown, field: string, maxLength?: number): string {
  assert(typeof value === 'string' && value.trim().length > 0, `${field} is required`);
  const trimmed = (value as string).trim();
  if (typeof maxLength === 'number') {
    assert(trimmed.length <= maxLength, `${field} must be at most ${maxLength} characters`);
  }
  return trimmed;
}

export function optionalString(value: unknown, field: string, maxLength?: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  return requireString(value, field, maxLength);
}

export function isEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function normalizePhone(value: unknown): string {
  assert(typeof value === 'string', 'phone number is required');
  const compact = (value as string).replace(/[\s()-]/g, '');
  assert(/^\+[1-9]\d{7,14}$/.test(compact), 'phone number must be in E.164 format (e.g. +639171234567)');
  return compact;
}

export function parseEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string
): T {
  assert(typeof value === 'string' && (allowed as readonly string[]).includes(value), `${field} is invalid`);
  return value as T;
}

export function optionalEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string
): T | null {
  if (value === undefined || value === null || value === '') return null;
  return parseEnum(value, allowed, field);
}
