import type { ArticleRow, ArticleStatus } from './types';

export type ArticleListItem = Pick<
  ArticleRow,
  'id' | 'slug' | 'title' | 'status' | 'publish_at' | 'category_id' | 'author_id' | 'updated_at'
> & {
  author_name: string | null;
  category_name: string | null;
};

export interface ArticleFilter {
  status?: ArticleStatus;
  categoryId?: string;
  q?: string;
  authorId?: string;
  limit?: number;
  offset?: number;
}

const COLUMNS =
  'id, slug, title, body, excerpt, eyecatch_url, category_id, author_id, status, publish_at, created_at, updated_at';

// Shared WHERE builder so listArticles and countArticles stay in sync.
function articleWhere(filter: ArticleFilter): { clause: string; binds: unknown[] } {
  const where: string[] = [];
  const binds: unknown[] = [];
  if (filter.status) { where.push('a.status = ?'); binds.push(filter.status); }
  if (filter.categoryId) { where.push('a.category_id = ?'); binds.push(filter.categoryId); }
  if (filter.authorId) { where.push('a.author_id = ?'); binds.push(filter.authorId); }
  if (filter.q) { where.push("a.title LIKE '%' || ? || '%'"); binds.push(filter.q); }
  return { clause: where.length ? ` WHERE ${where.join(' AND ')}` : '', binds };
}

export async function listArticles(db: D1Database, filter: ArticleFilter): Promise<ArticleListItem[]> {
  const { clause, binds } = articleWhere(filter);
  let sql =
    'SELECT a.id, a.slug, a.title, a.status, a.publish_at, a.category_id, a.author_id, a.updated_at,' +
    ' u.name AS author_name, c.name AS category_name' +
    ' FROM articles a' +
    ' LEFT JOIN users u ON u.id = a.author_id' +
    ' LEFT JOIN categories c ON c.id = a.category_id' +
    clause +
    ' ORDER BY a.publish_at DESC';
  if (filter.limit != null && Number.isFinite(filter.limit)) {
    sql += ' LIMIT ?'; binds.push(filter.limit);
    if (filter.offset != null && Number.isFinite(filter.offset)) { sql += ' OFFSET ?'; binds.push(filter.offset); }
  }
  const { results } = await db.prepare(sql).bind(...binds).all<ArticleListItem>();
  return results;
}

export async function countArticles(db: D1Database, filter: ArticleFilter): Promise<number> {
  const { clause, binds } = articleWhere(filter);
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM articles a${clause}`).bind(...binds).first<{ n: number }>();
  return row?.n ?? 0;
}

export async function getArticleById(db: D1Database, id: string): Promise<ArticleRow | null> {
  return db.prepare(`SELECT ${COLUMNS} FROM articles WHERE id = ?`).bind(id).first<ArticleRow>();
}

export async function getArticleBySlug(db: D1Database, slug: string): Promise<ArticleRow | null> {
  return db.prepare(`SELECT ${COLUMNS} FROM articles WHERE slug = ?`).bind(slug).first<ArticleRow>();
}

export async function slugExists(db: D1Database, slug: string, exceptId?: string): Promise<boolean> {
  const row = exceptId
    ? await db.prepare('SELECT 1 AS x FROM articles WHERE slug = ? AND id != ?').bind(slug, exceptId).first()
    : await db.prepare('SELECT 1 AS x FROM articles WHERE slug = ?').bind(slug).first();
  return row !== null;
}

export async function insertArticle(db: D1Database, a: ArticleRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO articles (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      a.id, a.slug, a.title, a.body, a.excerpt, a.eyecatch_url, a.category_id,
      a.author_id, a.status, a.publish_at, a.created_at, a.updated_at
    )
    .run();
}

export async function updateArticle(
  db: D1Database,
  id: string,
  fields: Pick<ArticleRow, 'slug' | 'title' | 'body' | 'excerpt' | 'eyecatch_url' | 'category_id' | 'status' | 'publish_at' | 'updated_at'>
): Promise<void> {
  await db
    .prepare(
      `UPDATE articles SET slug = ?, title = ?, body = ?, excerpt = ?, eyecatch_url = ?, category_id = ?, status = ?, publish_at = ?, updated_at = ? WHERE id = ?`
    )
    .bind(
      fields.slug, fields.title, fields.body, fields.excerpt, fields.eyecatch_url,
      fields.category_id, fields.status, fields.publish_at, fields.updated_at, id
    )
    .run();
}

export async function deleteArticle(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM articles WHERE id = ?').bind(id).run();
}

export type PublicArticleListItem = Pick<
  ArticleRow,
  'id' | 'slug' | 'title' | 'excerpt' | 'eyecatch_url' | 'category_id' | 'publish_at'
>;

export async function listPublicArticles(
  db: D1Database,
  now: number,
  opts: { categoryId?: string; limit?: number } = {}
): Promise<PublicArticleListItem[]> {
  const where = ["status = 'published'", 'publish_at <= ?'];
  const binds: unknown[] = [now];
  if (opts.categoryId) { where.push('category_id = ?'); binds.push(opts.categoryId); }
  let sql =
    'SELECT id, slug, title, excerpt, eyecatch_url, category_id, publish_at FROM articles' +
    ` WHERE ${where.join(' AND ')} ORDER BY publish_at DESC`;
  if (opts.limit && Number.isFinite(opts.limit)) { sql += ' LIMIT ?'; binds.push(opts.limit); }
  const { results } = await db.prepare(sql).bind(...binds).all<PublicArticleListItem>();
  return results;
}

export async function getPublicArticleBySlug(db: D1Database, slug: string, now: number): Promise<ArticleRow | null> {
  return db
    .prepare(`SELECT ${COLUMNS} FROM articles WHERE slug = ? AND status = 'published' AND publish_at <= ?`)
    .bind(slug, now)
    .first<ArticleRow>();
}
