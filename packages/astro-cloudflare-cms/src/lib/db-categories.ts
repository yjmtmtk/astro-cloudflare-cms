import type { CategoryRow } from './types';

export async function listCategories(
  db: D1Database,
  opts: { limit?: number; offset?: number } = {}
): Promise<CategoryRow[]> {
  let sql = 'SELECT id, slug, name, sort_order, created_at FROM categories ORDER BY sort_order ASC, name ASC';
  const binds: unknown[] = [];
  if (opts.limit != null && Number.isFinite(opts.limit)) {
    sql += ' LIMIT ?'; binds.push(opts.limit);
    if (opts.offset != null && Number.isFinite(opts.offset)) { sql += ' OFFSET ?'; binds.push(opts.offset); }
  }
  const { results } = await db.prepare(sql).bind(...binds).all<CategoryRow>();
  return results;
}

export async function countCategories(db: D1Database): Promise<number> {
  const row = await db.prepare('SELECT COUNT(*) AS n FROM categories').first<{ n: number }>();
  return row?.n ?? 0;
}

export async function getCategory(db: D1Database, id: string): Promise<CategoryRow | null> {
  return db
    .prepare('SELECT id, slug, name, sort_order, created_at FROM categories WHERE id = ?')
    .bind(id)
    .first<CategoryRow>();
}

export async function insertCategory(db: D1Database, c: CategoryRow): Promise<void> {
  await db
    .prepare('INSERT INTO categories (id, slug, name, sort_order, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(c.id, c.slug, c.name, c.sort_order, c.created_at)
    .run();
}

export async function updateCategory(
  db: D1Database,
  id: string,
  fields: { slug: string; name: string; sort_order: number }
): Promise<void> {
  await db
    .prepare('UPDATE categories SET slug = ?, name = ?, sort_order = ? WHERE id = ?')
    .bind(fields.slug, fields.name, fields.sort_order, id)
    .run();
}

export async function deleteCategory(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
}
