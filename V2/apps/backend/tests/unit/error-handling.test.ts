import request from 'supertest';
import { app } from '../../src/app';

describe('error handling', () => {
  it('returns 400 for a malformed JSON body instead of 500', async () => {
    const response = await request(app)
      .post('/api/auth/admin/login')
      .type('json')
      .send('{"email": ');

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('BAD_REQUEST');
  });
});
