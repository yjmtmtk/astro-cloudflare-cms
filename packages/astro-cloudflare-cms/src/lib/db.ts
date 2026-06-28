import type { UserRow, SessionRow } from './types';

export async function getUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  return db
    .prepare('SELECT id, email, password_hash, password_salt, role, name, created_at FROM users WHERE email = ?')
    .bind(email)
    .first<UserRow>();
}

export async function getUserById(db: D1Database, id: string): Promise<UserRow | null> {
  return db
    .prepare('SELECT id, email, password_hash, password_salt, role, name, created_at FROM users WHERE id = ?')
    .bind(id)
    .first<UserRow>();
}

export async function insertUser(db: D1Database, u: UserRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO users (id, email, password_hash, password_salt, role, name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(u.id, u.email, u.password_hash, u.password_salt, u.role, u.name, u.created_at)
    .run();
}

export async function insertSession(db: D1Database, s: SessionRow): Promise<void> {
  await db
    .prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(s.id, s.user_id, s.expires_at, s.created_at)
    .run();
}

export async function getSessionWithUser(
  db: D1Database,
  sessionId: string
): Promise<{ session: SessionRow; user: UserRow } | null> {
  const row = await db
    .prepare(
      `SELECT s.id AS s_id, s.user_id, s.expires_at, s.created_at AS s_created,
              u.id AS u_id, u.email, u.password_hash, u.password_salt, u.role, u.name, u.created_at AS u_created
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`
    )
    .bind(sessionId)
    .first<Record<string, unknown>>();
  if (!row) return null;
  return {
    session: {
      id: row.s_id as string,
      user_id: row.user_id as string,
      expires_at: row.expires_at as number,
      created_at: row.s_created as number,
    },
    user: {
      id: row.u_id as string,
      email: row.email as string,
      password_hash: row.password_hash as string,
      password_salt: row.password_salt as string,
      role: row.role as UserRow['role'],
      name: row.name as string,
      created_at: row.u_created as number,
    },
  };
}

export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

export async function deleteExpiredSessions(db: D1Database, now: number): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now).run();
}
