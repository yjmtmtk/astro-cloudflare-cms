import type { Role, UserRow } from './types';

export type PublicUser = Omit<UserRow, 'password_hash' | 'password_salt'>;

export async function listUsers(
  db: D1Database,
  opts: { limit?: number; offset?: number } = {}
): Promise<PublicUser[]> {
  let sql = 'SELECT id, email, role, name, created_at FROM users ORDER BY created_at ASC';
  const binds: unknown[] = [];
  if (opts.limit != null && Number.isFinite(opts.limit)) {
    sql += ' LIMIT ?'; binds.push(opts.limit);
    if (opts.offset != null && Number.isFinite(opts.offset)) { sql += ' OFFSET ?'; binds.push(opts.offset); }
  }
  const { results } = await db.prepare(sql).bind(...binds).all<PublicUser>();
  return results;
}

export async function countUsers(db: D1Database): Promise<number> {
  const row = await db.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>();
  return row?.n ?? 0;
}

export async function countArticlesByAuthor(db: D1Database, userId: string): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM articles WHERE author_id = ?')
    .bind(userId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function updateUserProfile(
  db: D1Database,
  id: string,
  fields: { name: string; role: Role }
): Promise<void> {
  await db.prepare('UPDATE users SET name = ?, role = ? WHERE id = ?').bind(fields.name, fields.role, id).run();
}

export async function updateUserPassword(db: D1Database, id: string, hash: string, salt: string): Promise<void> {
  await db.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').bind(hash, salt, id).run();
}

export async function deleteUser(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
}

export async function countMasters(db: D1Database): Promise<number> {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'master'").first<{ n: number }>();
  return row?.n ?? 0;
}
