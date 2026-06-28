import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import {
  insertUser, getUserByEmail, getUserById,
  insertSession, getSessionWithUser, deleteSession, deleteExpiredSessions,
} from '@/lib/db';
import type { UserRow, SessionRow } from '@/lib/types';

// Per-test isolated storage: each `it` starts from the migrated-but-empty DB
// seeded by test/apply-migrations.ts; writes roll back after each test.
const user: UserRow = {
  id: 'u1', email: 'a@example.com', password_hash: 'h', password_salt: 's',
  role: 'master', name: 'Admin', created_at: 1000,
};

describe('db users', () => {
  it('inserts and fetches a user by email and id', async () => {
    await insertUser(env.DB, user);
    expect(await getUserByEmail(env.DB, 'a@example.com')).toMatchObject({ id: 'u1', role: 'master' });
    expect(await getUserById(env.DB, 'u1')).toMatchObject({ email: 'a@example.com' });
    expect(await getUserByEmail(env.DB, 'missing@example.com')).toBeNull();
  });
});

describe('db sessions', () => {
  it('creates a session and resolves it with its user', async () => {
    await insertUser(env.DB, user);
    const s: SessionRow = { id: 'sess1', user_id: 'u1', expires_at: 9999, created_at: 1000 };
    await insertSession(env.DB, s);
    const got = await getSessionWithUser(env.DB, 'sess1');
    expect(got?.user.id).toBe('u1');
    expect(got?.session.id).toBe('sess1');
  });

  it('deletes a session', async () => {
    await insertUser(env.DB, user);
    await insertSession(env.DB, { id: 'sess1', user_id: 'u1', expires_at: 9999, created_at: 1000 });
    await deleteSession(env.DB, 'sess1');
    expect(await getSessionWithUser(env.DB, 'sess1')).toBeNull();
  });

  it('deletes expired sessions only', async () => {
    await insertUser(env.DB, user);
    await insertSession(env.DB, { id: 'old', user_id: 'u1', expires_at: 500, created_at: 100 });
    await insertSession(env.DB, { id: 'new', user_id: 'u1', expires_at: 9999, created_at: 100 });
    await deleteExpiredSessions(env.DB, 1000);
    expect(await getSessionWithUser(env.DB, 'old')).toBeNull();
    expect(await getSessionWithUser(env.DB, 'new')).not.toBeNull();
  });
});
