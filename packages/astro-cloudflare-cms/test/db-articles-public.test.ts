import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import { insertUser } from '@/lib/db';
import { insertArticle } from '@/lib/db-articles';
import { listPublicArticles, getPublicArticleBySlug } from '@/lib/db-articles';
import type { ArticleRow, UserRow } from '@/lib/types';

const u: UserRow = { id: 'u', email: 'e', password_hash: 'h', password_salt: 's', role: 'author', name: 'U', created_at: 1 };
const art = (o: Partial<ArticleRow> = {}): ArticleRow => ({
  id: 'a', slug: 's', title: 'T', body: '<p>b</p>', excerpt: null, eyecatch_url: null,
  category_id: null, author_id: 'u', status: 'published', publish_at: 100, created_at: 1, updated_at: 1, ...o,
});

describe('public visibility', () => {
  it('lists only published with publish_at <= now, newest first', async () => {
    await insertUser(env.DB, u);
    await insertArticle(env.DB, art({ id: 'pub', slug: 'pub', status: 'published', publish_at: 100 }));
    await insertArticle(env.DB, art({ id: 'future', slug: 'future', status: 'published', publish_at: 5000 }));
    await insertArticle(env.DB, art({ id: 'hidden', slug: 'hidden', status: 'hidden', publish_at: 100 }));
    const list = await listPublicArticles(env.DB, 1000);
    expect(list.map((a) => a.id)).toEqual(['pub']); // future + hidden excluded
  });

  it('getPublicArticleBySlug respects visibility', async () => {
    await insertUser(env.DB, u);
    await insertArticle(env.DB, art({ id: 'pub', slug: 'pub', status: 'published', publish_at: 100 }));
    await insertArticle(env.DB, art({ id: 'future', slug: 'future', status: 'published', publish_at: 5000 }));
    expect((await getPublicArticleBySlug(env.DB, 'pub', 1000))?.id).toBe('pub');
    expect(await getPublicArticleBySlug(env.DB, 'future', 1000)).toBeNull();
    expect(await getPublicArticleBySlug(env.DB, 'missing', 1000)).toBeNull();
  });
});
