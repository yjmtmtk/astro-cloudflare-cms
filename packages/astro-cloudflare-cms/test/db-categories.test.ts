import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import {
  listCategories, getCategory, insertCategory, updateCategory, deleteCategory,
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
});
