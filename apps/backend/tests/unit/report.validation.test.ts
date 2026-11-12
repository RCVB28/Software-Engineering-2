import { AlertCategory, ReportSeverity, ReportStatus } from '@prisma/client';
import { assertTransition, parseReportInput } from '../../src/modules/reports/report.validation';

describe('report validation', () => {
  const base = {
    category: AlertCategory.FLOOD,
    severity: ReportSeverity.HIGH,
    description: 'Water is rising near the covered court.'
  };

  it('accepts an address-only report', () => {
    const input = parseReportInput({ ...base, addressText: '12 Mabini Street' });
    expect(input.addressText).toBe('12 Mabini Street');
    expect(input.latitude).toBeNull();
  });

  it('accepts a coordinate report', () => {
    const input = parseReportInput({ ...base, latitude: 14.5, longitude: 121.0 });
    expect(input.latitude).toBe(14.5);
    expect(input.longitude).toBe(121.0);
  });

  it('requires a location', () => {
    expect(() => parseReportInput(base)).toThrow('Provide latitude and longitude or an address');
  });

  it('requires latitude and longitude together', () => {
    expect(() => parseReportInput({ ...base, latitude: 14.5 })).toThrow('provided together');
  });

  it('enforces the 500-character description limit', () => {
    expect(() => parseReportInput({ ...base, description: 'x'.repeat(501), addressText: 'a' })).toThrow(
      'at most 500'
    );
  });

  it('rejects invalid enums', () => {
    expect(() => parseReportInput({ ...base, category: 'METEOR', addressText: 'a' })).toThrow(
      'category is invalid'
    );
  });

  it('allows only defined status transitions', () => {
    expect(() => assertTransition(ReportStatus.NEW, ReportStatus.ACKNOWLEDGED)).not.toThrow();
    expect(() => assertTransition(ReportStatus.NEW, ReportStatus.DISMISSED)).not.toThrow();
    expect(() => assertTransition(ReportStatus.ACKNOWLEDGED, ReportStatus.RESOLVED)).not.toThrow();
    expect(() => assertTransition(ReportStatus.NEW, ReportStatus.RESOLVED)).toThrow('Cannot transition');
    expect(() => assertTransition(ReportStatus.RESOLVED, ReportStatus.ACKNOWLEDGED)).toThrow(
      'Cannot transition'
    );
    expect(() => assertTransition(ReportStatus.NEW, ReportStatus.NEW)).toThrow('already NEW');
  });
});
