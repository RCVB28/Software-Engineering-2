import { signAccessToken, verifyAccessToken } from '../../src/modules/auth/token';

describe('JWT tokens', () => {
  it('round-trips a principal payload', () => {
    const token = signAccessToken({
      sub: 'admin-1',
      kind: 'ADMIN',
      role: 'HIGH_LEVEL',
      barangayId: null,
      email: 'admin@example.com'
    });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('admin-1');
    expect(payload.kind).toBe('ADMIN');
    expect(payload.role).toBe('HIGH_LEVEL');
  });

  it('rejects tampered tokens', () => {
    const token = signAccessToken({ sub: 'r1', kind: 'RESIDENT', role: 'RESIDENT' });
    expect(() => verifyAccessToken(`${token}tampered`)).toThrow();
  });
});
