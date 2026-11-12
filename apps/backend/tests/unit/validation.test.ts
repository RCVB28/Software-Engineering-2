import {
  assert,
  ensureObject,
  isEmail,
  normalizePhone,
  optionalEnum,
  optionalString,
  parseEnum,
  requireString
} from '../../src/middleware/validation';
import { AlertCategory } from '@prisma/client';

describe('validation helpers', () => {
  it('normalizes formatted phone numbers to E.164', () => {
    expect(normalizePhone('+63 (917) 000-0001')).toBe('+639170000001');
  });

  it('rejects non-E.164 phone numbers', () => {
    expect(() => normalizePhone('09170000001')).toThrow('E.164');
    expect(() => normalizePhone('not-a-phone')).toThrow('E.164');
  });

  it('validates email addresses', () => {
    expect(isEmail('user@example.com')).toBe(true);
    expect(isEmail('nope')).toBe(false);
  });

  it('trims required strings and enforces max length', () => {
    expect(requireString('  hello  ', 'field')).toBe('hello');
    expect(() => requireString('   ', 'field')).toThrow('field is required');
    expect(() => requireString('abcdef', 'field', 3)).toThrow('at most 3');
  });

  it('returns null for empty optional strings', () => {
    expect(optionalString(undefined, 'field')).toBeNull();
    expect(optionalString('', 'field')).toBeNull();
    expect(optionalString('value', 'field')).toBe('value');
  });

  it('asserts and throws validation errors', () => {
    expect(() => assert(false, 'boom')).toThrow('boom');
    expect(ensureObject({ a: 1 })).toEqual({ a: 1 });
    expect(() => ensureObject([])).toThrow('Expected an object');
  });

  it('parses enums and rejects unknown values', () => {
    expect(parseEnum('FIRE', Object.values(AlertCategory), 'category')).toBe(AlertCategory.FIRE);
    expect(() => parseEnum('NOPE', Object.values(AlertCategory), 'category')).toThrow('invalid');
    expect(optionalEnum(undefined, Object.values(AlertCategory), 'category')).toBeNull();
  });
});
