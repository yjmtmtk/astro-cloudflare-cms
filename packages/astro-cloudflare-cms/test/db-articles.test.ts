import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import { insertUser } from '@/lib/db';
import {
  listArticles, getArticleById, getArticleBySlug, slugExists,
  insertArticle, updateArticle, deleteArticle,
} from '@/lib/db-articles';
import type { ArticleRow, UserRow } from '@/lib/types';

const author: UserRow = { id: 'a', email: 'a@x', password_hash: 'h', password_salt: 's', role: 'author', name: 'A', created_at: 1 };
const art = (over: Partial<ArticleRow> = {}): ArticleRow => ({
  id: 'art1', slug: 'first', title: 'First', body: '<p>b</p>', excerpt: null, eyecatch_url: null,
  category_id: null, author_id: 'a', status: 'published', publish_at: 1000, created_at: 1000, updated_at: 1000, ...over,
});

describe('db-articles', () => {
  it('inserts, gets by id and slug, detects slug collisions', async () => {
    await insertUser(env.DB, author);
    await insertArticle(env.DB, art());
    expect((await getArticleById(env.DB, 'art1'))?.title).toBe('First');
    expect((await getArticleBySlug(env.DB, 'first'))?.id).toBe('art1');
    expect(await slugExists(env.DB, 'first')).toBe(true);
    expect(await slugExists(env.DB, 'first', 'art1')).toBe(false); // excluded self
    expect(await slugExists(env.DB, 'nope')).toBe(false);
  });

  it('lists with status/category/title/author filters, newest first', async () => {
    await insertUser(env.DB, author);
    await env.DB.prepare("INSERT INTO categories (id,slug,name,sort_order,created_at) VALUES ('c1','c','C',0,1)").run();
    await insertArticle(env.DB, art({ id: 'a1', slug: 's1', title: 'Apple news', status: 'published', category_id: 'c1', publish_at: 100 }));
    await insertArticle(env.DB, art({ id: 'a2', slug: 's2', title: 'Banana', status: 'hidden', category_id: null, publish_at: 200 }));

    const all = await listArticles(env.DB, {});
    expect(all.map((a) => a.id)).toEqual(['a2', 'a1']); // publish_at desc

    expect((await listArticles(env.DB, { status: 'hidden' })).map((a) => a.id)).toEqual(['a2']);
    expect((await listArticles(env.DB, { categoryId: 'c1' })).map((a) => a.id)).toEqual(['a1']);
    expect((await listArticles(env.DB, { q: 'apple' })).map((a) => a.id)).toEqual(['a1']);
    expect((await listArticles(env.DB, { authorId: 'a' })).length).toBe(2);
    expect((await listArticles(env.DB, { authorId: 'other' })).length).toBe(0);
  });

  it('updates and deletes', async () => {
    await insertUser(env.DB, author);
    await insertArticle(env.DB, art());
    await updateArticle(env.DB, 'art1', {
      slug: 'first', title: 'Updated', body: '<p>n</p>', excerpt: 'ex', eyecatch_url: null,
      category_id: null, status: 'hidden', publish_at: 2000, updated_at: 2000,
    });
    const got = await getArticleById(env.DB, 'art1');
    expect(got?.title).toBe('Updated');
    expect(got?.status).toBe('hidden');
    await deleteArticle(env.DB, 'art1');
    expect(await getArticleById(env.DB, 'art1')).toBeNull();
  });
});
