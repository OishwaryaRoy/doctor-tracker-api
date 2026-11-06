import { describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { api, createUser, sessionCookie } from './helpers.js';

function sessionCookieFrom(setCookie: string[] | string | undefined) {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return cookies.find((cookie) => cookie.startsWith(`${env.COOKIE_NAME}=`));
}

describe('POST /api/v1/auth/login', () => {
  it('signs in with valid credentials and sets an httpOnly session cookie', async () => {
    const { email, password } = await createUser('admin');

    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: email.toUpperCase(), password });

    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ email, role: 'admin' });
    expect(res.body.data.user).not.toHaveProperty('passwordHash');

    const cookie = sessionCookieFrom(res.headers['set-cookie']);
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('returns the same error for a wrong password and an unknown email', async () => {
    const { email } = await createUser('admin');

    const wrongPassword = await api().post('/api/v1/auth/login').send({ email, password: 'nope' });
    const unknownEmail = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@test.dev', password: 'nope' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
  });

  it('validates the request body', async () => {
    const res = await api().post('/api/v1/auth/login').send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual(
      expect.arrayContaining(['body.email', 'body.password']),
    );
  });

  it('rejects malformed JSON with a 400', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Malformed JSON body');
  });

  it('rate-limits repeated failed attempts', async () => {
    const attempts = [];
    for (let i = 0; i < 11; i++) {
      attempts.push(
        await api().post('/api/v1/auth/login').send({ email: 'x@test.dev', password: 'wrong' }),
      );
    }

    expect(attempts.slice(0, 10).every((res) => res.status === 401)).toBe(true);
    expect(attempts[10]!.status).toBe(429);
    expect(attempts[10]!.body.error.code).toBe('TOO_MANY_REQUESTS');

    const { email, password } = await createUser('admin');
    const otherUser = await api().post('/api/v1/auth/login').send({ email, password });
    expect(otherUser.status).toBe(200);
  });
});

describe('session', () => {
  it('GET /auth/me returns the signed-in user', async () => {
    const { user } = await createUser('viewer');

    const res = await api()
      .get('/api/v1/auth/me')
      .set('Cookie', sessionCookie('viewer', user._id.toString()));

    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ id: user._id.toString(), role: 'viewer' });
  });

  it('accepts a Bearer token for API clients', async () => {
    const { user } = await createUser('admin');
    const token = sessionCookie('admin', user._id.toString()).split('=')[1];

    const res = await api().get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('rejects missing and tampered tokens', async () => {
    const missing = await api().get('/api/v1/auth/me');
    const tampered = await api()
      .get('/api/v1/auth/me')
      .set('Cookie', `${sessionCookie('admin')}tampered`);

    expect(missing.status).toBe(401);
    expect(tampered.status).toBe(401);
  });

  it('POST /auth/logout clears the session cookie', async () => {
    const res = await api().post('/api/v1/auth/logout');

    expect(res.status).toBe(204);
    expect(sessionCookieFrom(res.headers['set-cookie'])).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it.each([
    '/api/v1/doctors',
    '/api/v1/patients',
    '/api/v1/stats/overview',
    '/api/v1/meta/options',
  ])('protects %s', async (path) => {
    const res = await api().get(path);
    expect(res.status).toBe(401);
  });
});
