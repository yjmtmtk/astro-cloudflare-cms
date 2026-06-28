import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import { insertUser } from '@/lib/db';
import { hashPassword, login, resolveSession, logout, SESSION_COOKIE } from '@/lib/auth';
import type { UserRow } from '@/lib/types';

// Per-test isolated storage: each `it` starts from the migrated-but-empty DB
// seeded by test/apply-migrations.ts; writes roll back after each test.
async function makeUser(): Promise<UserRow> {
  const { hash, salt } = await hashPassword('pw123456');
  const u: UserRow = {
    id: 'u1', email: 'm@example.com', password_hash: hash, password_salt: salt,
    role: 'master', name: 'Master', created_at: 1000,
  };
  await insertUser(env.DB, u);
  return u;
}

describe('login', () => {
  it('returns a session for valid credentials', async () => {
    await makeUser();
    const res = await login(env.DB, 'm@example.com', 'pw123456', 1000);
    expect(res?.user).toMatchObject({ email: 'm@example.com', role: 'master' });
    expect(res?.sessionId).toBeTruthy();
  });

  it('returns null for a wrong password', async () => {
    await makeUser();
    expect(await login(env.DB, 'm@example.com', 'nope', 1000)).toBeNull();
  });

  it('returns null for an unknown email', async () => {
    expect(await login(env.DB, 'ghost@example.com', 'pw123456', 1000)).toBeNull();
  });
});

describe('resolveSession', () => {
  it('resolves a valid session to its user', async () => {
    await makeUser();
    const res = await login(env.DB, 'm@example.com', 'pw123456', 1000);
    const user = await resolveSession(env.DB, res!.sessionId, 1000);
    expect(user).toMatchObject({ id: 'u1', role: 'master' });
  });

  it('returns null for an expired session', async () => {
    await makeUser();
    const res = await login(env.DB, 'm@example.com', 'pw123456', 1000);
    const later = 1000 + 60 * 60 * 24 * 8; // 8 days > 7-day TTL
    expect(await resolveSession(env.DB, res!.sessionId, later)).toBeNull();
  });

  it('returns null after logout', async () => {
    await makeUser();
    const res = await login(env.DB, 'm@example.com', 'pw123456', 1000);
    await logout(env.DB, res!.sessionId);
    expect(await resolveSession(env.DB, res!.sessionId, 1000)).toBeNull();
  });
});

describe('cookie constant', () => {
  it('uses the agreed name', () => {
    expect(SESSION_COOKIE).toBe('nanocms_session');
  });
});
