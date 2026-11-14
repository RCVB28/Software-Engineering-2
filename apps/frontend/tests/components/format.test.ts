import { describeTarget, formatDate } from '../../src/components/format';

describe('formatDate', () => {
  it('renders a dash for missing values', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
  });

  it('formats ISO timestamps', () => {
    expect(formatDate('2026-11-12T10:30:00.000Z')).not.toBe('—');
  });
});

describe('describeTarget', () => {
  const barangays = [
    { id: 'barangay-a', name: 'Barangay Uno' },
    { id: 'barangay-b', name: 'Barangay Dos' }
  ];

  it('combines a resolved barangay name with a resident role', () => {
    expect(
      describeTarget({ barangayId: 'barangay-a', residentRole: 'STUDENT' }, barangays)
    ).toBe('Barangay Uno / Student');
  });

  it('falls back to the identifier when the barangay is unknown', () => {
    expect(
      describeTarget({ barangayId: 'missing-id', residentRole: null }, barangays)
    ).toBe('missing-id');
  });

  it('describes an unrestricted target as everyone', () => {
    expect(describeTarget({ barangayId: null, residentRole: null }, barangays)).toBe(
      'Everyone'
    );
  });
});