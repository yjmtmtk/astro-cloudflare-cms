import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import { insertUser } from '@/lib/db';
import {
  listUsers, countUsers, countArticlesByAuthor, updateUserProfile, deleteUser,
} from '@/lib/db-users';
import type { UserRow } from '@/lib/types';

const u = (over: Partial<UserRow> = {}): UserRow => ({
  id: 'u1', email: 'u1@x', password_hash: 'h', password_salt: 's',
  role: 'author', name: 'U1', created_at: 1000, ...over,
});

describe('db-users', () => {
  it('lists users without secret fields', async () => {
    await insertUser(env.DB, u({ id: 'u1', email: 'a@x' }));
    const list = await listUsers(env.DB);
    expect(list).toHaveLength(1);
    expect(list[0]).not.toHaveProperty('password_hash');
    expect(list[0]).not.toHaveProperty('password_salt');
    expect(list[0]).toMatchObject({ id: 'u1', email: 'a@x', role: 'author' });
  });

  it('counts a user authored articles', async () => {
    await insertUser(env.DB, u({ id: 'u1' }));
    expect(await countArticlesByAuthor(env.DB, 'u1')).toBe(0);
    await env.DB.prepare(
      `INSERT INTO articles (id, slug, title, body, excerpt, eyecatch_url, category_id, author_id, status, publish_at, created_at, updated_at)
       VALUES ('art1','s','T','<p>x</p>',NULL,NULL,NULL,'u1','hidden',1000,1000,1000)`
    ).run();
    expect(await countArticlesByAuthor(env.DB, 'u1')).toBe(1);
  });

  it('paginates with limit/offset (created_at asc) and counts', async () => {
    for (let i = 1; i <= 5; i++) {
      await insertUser(env.DB, u({ id: `u${i}`, email: `u${i}@x`, created_at: i }));
    }
    expect((await listUsers(env.DB, { limit: 2, offset: 0 })).map((x) => x.id)).toEqual(['u1', 'u2']);
    expect((await listUsers(env.DB, { limit: 2, offset: 2 })).map((x) => x.id)).toEqual(['u3', 'u4']);
    expect(await countUsers(env.DB)).toBe(5);
  });

  it('updates profile and deletes', async () => {
    await insertUser(env.DB, u({ id: 'u1' }));
    await updateUserProfile(env.DB, 'u1', { name: 'New', role: 'master' });
    const list = await listUsers(env.DB);
    expect(list[0]).toMatchObject({ name: 'New', role: 'master' });
    await deleteUser(env.DB, 'u1');
    expect(await listUsers(env.DB)).toHaveLength(0);
  });
});
