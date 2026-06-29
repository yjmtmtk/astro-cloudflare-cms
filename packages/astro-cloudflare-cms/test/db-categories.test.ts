import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import {
  listCategories, countCategories, getCategory, insertCategory, updateCategory, deleteCategory,
} from '@/lib/db-categories';
import type { CategoryRow } from '@/lib/types';

const cat = (over: Partial<CategoryRow> = {}): CategoryRow => ({
  id: 'c1', slug: 'news', name: 'News', sort_order: 0, created_at: 1000, ...over,
});

describe('db-categories', () => {
  it('inserts, lists (ordered), gets, updates, deletes', async () => {
    await insertCategory(env.DB, cat({ id: 'c1', slug: 'b', name: 'B', sort_order: 2 }));
    await insertCategory(env.DB, cat({ id: 'c2', slug: 'a', name: 'A', sort_order: 1 }));
    const list = await listCategories(env.DB);
    expect(list.map((c) => c.id)).toEqual(['c2', 'c1']); // sort_order asc

    expect((await getCategory(env.DB, 'c1'))?.name).toBe('B');

    await updateCategory(env.DB, 'c1', { slug: 'b2', name: 'B2', sort_order: 5 });
    expect((await getCategory(env.DB, 'c1'))?.name).toBe('B2');

    await deleteCategory(env.DB, 'c2');
    expect(await getCategory(env.DB, 'c2')).toBeNull();
  });

  it('paginates with limit/offset (sort_order asc) and counts', async () => {
    for (let i = 1; i <= 5; i++) {
      await insertCategory(env.DB, cat({ id: `c${i}`, slug: `s${i}`, name: `N${i}`, sort_order: i }));
    }
    expect((await listCategories(env.DB, { limit: 2, offset: 0 })).map((c) => c.id)).toEqual(['c1', 'c2']);
    expect((await listCategories(env.DB, { limit: 2, offset: 2 })).map((c) => c.id)).toEqual(['c3', 'c4']);
    expect(await countCategories(env.DB)).toBe(5);
  });
});
