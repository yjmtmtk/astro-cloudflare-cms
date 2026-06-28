import type { MediaRow } from './types';
import { cmsMediaPath } from './media-url';

export const ORPHAN_GRACE_HOURS = 24;
export const RECONCILE_GRACE_SECONDS = 300;

export function extractMediaKeys(html: string, eyecatchUrl: string | null): Set<string> {
  const keys = new Set<string>();
  const re = /\/cms-media\/([^\s"')>?#]+)/g;
  const scan = (s: string) => {
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(s)) !== null) keys.add(mm[1]);
  };
  scan(html);
  if (eyecatchUrl) scan(eyecatchUrl);
  return keys;
}

export async function insertMedia(db: D1Database, m: MediaRow): Promise<void> {
  await db
    .prepare('INSERT INTO media (id, r2_key, url, article_id, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(m.id, m.r2_key, m.url, m.article_id, m.created_at)
    .run();
}

export async function listMediaByArticle(db: D1Database, articleId: string): Promise<MediaRow[]> {
  const { results } = await db
    .prepare('SELECT id, r2_key, url, article_id, created_at FROM media WHERE article_id = ?')
    .bind(articleId)
    .all<MediaRow>();
  return results;
}

export async function deleteMediaByKeys(db: D1Database, env: { MEDIA: R2Bucket }, keys: string[]): Promise<void> {
  for (const key of keys) {
    await db.prepare('DELETE FROM media WHERE r2_key = ?').bind(key).run();
    await env.MEDIA.delete(key);
  }
}

export async function storeUpload(
  env: { MEDIA: R2Bucket; DB: D1Database },
  articleId: string,
  bytes: ArrayBuffer | Uint8Array,
  contentType: string,
  now: number
): Promise<MediaRow> {
  const r2_key = `articles/${crypto.randomUUID()}.webp`;
  await env.MEDIA.put(r2_key, bytes, { httpMetadata: { contentType } });
  const row: MediaRow = { id: crypto.randomUUID(), r2_key, url: cmsMediaPath(r2_key), article_id: articleId, created_at: now };
  await insertMedia(env.DB, row);
  return row;
}

export async function reconcileArticleMedia(
  db: D1Database,
  env: { MEDIA: R2Bucket },
  articleId: string,
  body: string,
  eyecatchUrl: string | null,
  now: number
): Promise<void> {
  const referenced = extractMediaKeys(body, eyecatchUrl);
  const rows = await listMediaByArticle(db, articleId);
  const cutoff = now - RECONCILE_GRACE_SECONDS;
  const toDelete = rows.filter((r) => !referenced.has(r.r2_key) && r.created_at <= cutoff).map((r) => r.r2_key);
  await deleteMediaByKeys(db, env, toDelete);
}

export async function cascadeDeleteArticleMedia(
  db: D1Database,
  env: { MEDIA: R2Bucket },
  articleId: string
): Promise<void> {
  const rows = await listMediaByArticle(db, articleId);
  await deleteMediaByKeys(db, env, rows.map((r) => r.r2_key));
}

export async function gcOrphans(db: D1Database, env: { MEDIA: R2Bucket }, now: number): Promise<number> {
  const cutoff = now - ORPHAN_GRACE_HOURS * 3600;
  const { results } = await db
    .prepare(
      `SELECT r2_key FROM media
       WHERE created_at < ?
       AND article_id NOT IN (SELECT id FROM articles)`
    )
    .bind(cutoff)
    .all<{ r2_key: string }>();
  const keys = results.map((r) => r.r2_key);
  await deleteMediaByKeys(db, env, keys);
  return keys.length;
}
