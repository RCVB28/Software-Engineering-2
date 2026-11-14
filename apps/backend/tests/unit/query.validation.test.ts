import { AppError } from '../../src/middleware/error';
import {
  parseDateRange,
  parseOptionalEnum,
  parseOptionalInstant,
  parsePage,
  parsePageSize,
  parseSearch
} from '../../src/middleware/query';

function expectValidationError(fn: () => unknown): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).status).toBe(400);
    expect((error as AppError).code).toBe('VALIDATION_ERROR');
    return;
  }
  throw new Error('Expected a validation error');
}

describe('query validation', () => {
  it('defaults page and page size', () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage('')).toBe(1);
    expect(parsePageSize(undefined)).toBe(20);
    expect(parsePageSize('')).toBe(20);
  });

  it('accepts bounded numeric page values', () => {
    expect(parsePage('3')).toBe(3);
    expect(parsePageSize('100')).toBe(100);
  });

  it('rejects invalid page values', () => {
    expectValidationError(() => parsePage('0'));
    expectValidationError(() => parsePage('-1'));
    expectValidationError(() => parsePage('1.5'));
    expectValidationError(() => parsePage('abc'));
    expectValidationError(() => parsePageSize('0'));
    expectValidationError(() => parsePageSize('101'));
    expectValidationError(() => parsePageSize('ten'));
  });

  it('validates optional enum filters', () => {
    const categories = ['FLOOD', 'FIRE'] as const;
    expect(parseOptionalEnum(undefined, categories, 'category')).toBeNull();
    expect(parseOptionalEnum('FLOOD', categories, 'category')).toBe('FLOOD');
    expectValidationError(() => parseOptionalEnum('EARTHQUAKE', categories, 'category'));
  });

  it('parses optional ISO instants and enforces from <= to', () => {
    const from = parseOptionalInstant('2026-01-01T00:00:00.000Z', 'from');
    expect(from?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(parseOptionalInstant(undefined, 'from')).toBeNull();
    expect(parseOptionalInstant('', 'from')).toBeNull();
    expectValidationError(() => parseOptionalInstant('not-a-date', 'from'));

    const range = parseDateRange('2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z');
    expect(range.from?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(range.to?.toISOString()).toBe('2026-01-02T00:00:00.000Z');
    expectValidationError(() =>
      parseDateRange('2026-01-03T00:00:00.000Z', '2026-01-02T00:00:00.000Z')
    );
  });

  it('trims search text and enforces the length bound', () => {
    expect(parseSearch('  flood  ')).toBe('flood');
    expect(parseSearch('   ')).toBeNull();
    expect(parseSearch(undefined)).toBeNull();
    expectValidationError(() => parseSearch('x'.repeat(201)));
    expectValidationError(() => parseSearch(42));
  });
});
