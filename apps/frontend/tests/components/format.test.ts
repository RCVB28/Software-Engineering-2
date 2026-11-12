import { formatDate } from '../../src/components/format';

describe('formatDate', () => {
  it('renders a dash for missing values', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
  });

  it('formats ISO timestamps', () => {
    expect(formatDate('2026-11-12T10:30:00.000Z')).not.toBe('—');
  });
});
