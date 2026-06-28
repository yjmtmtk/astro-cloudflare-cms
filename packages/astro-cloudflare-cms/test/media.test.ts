import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import {
  extractMediaKeys, insertMedia, listMediaByArticle, deleteMediaByKeys, storeUpload,
  reconcileArticleMedia, cascadeDeleteArticleMedia, gcOrphans, RECONCILE_GRACE_SECONDS,
} from '@/lib/media';
import type { MediaRow } from '@/lib/types';

const m = (over: Partial<MediaRow> = {}): MediaRow => ({
  id: 'm1', r2_key: 'articles/k1.webp', url: '/cms-media/articles/k1.webp', article_id: 'art1', created_at: 1000, ...over,
});

describe('extractMediaKeys', () => {
  it('pulls keys from body and eyecatch', () => {
    const html = '<p><img src="/cms-media/articles/a.webp"> x <img src="/cms-media/articles/b.webp"></p>';
    const keys = extractMediaKeys(html, '/cms-media/articles/c.webp');
    expect([...keys].sort()).toEqual(['articles/a.webp', 'articles/b.webp', 'articles/c.webp']);
  });
  it('handles no matches / null eyecatch', () => {
    expect(extractMediaKeys('<p>none</p>', null).size).toBe(0);
  });
  it('excludes query string and angle-bracket terminators from key', () => {
    const html = '<img src=/cms-media/k.webp?v=2> <img src=/cms-media/j.webp#anchor>';
    const keys = [...extractMediaKeys(html, null)].sort();
    expect(keys).toEqual(['j.webp', 'k.webp']);
  });
});

describe('media db + storage', () => {
  it('inserts and lists by article', async () => {
    await insertMedia(env.DB, m({ id: 'm1', r2_key: 'articles/k1.webp', article_id: 'art1' }));
    await insertMedia(env.DB, m({ id: 'm2', r2_key: 'articles/k2.webp', article_id: 'art2' }));
    const list = await listMediaByArticle(env.DB, 'art1');
    expect(list.map((x) => x.id)).toEqual(['m1']);
  });

  it('storeUpload puts to R2 and records a media row', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const row = await storeUpload(env, 'artX', bytes, 'image/webp', 2000);
    expect(row.r2_key).toMatch(/^articles\/.+\.webp$/);
    expect(row.url).toBe(`/cms-media/${row.r2_key}`);
    const obj = await env.MEDIA.get(row.r2_key);
    expect(obj).not.toBeNull();
    expect((await listMediaByArticle(env.DB, 'artX')).length).toBe(1);
  });

  it('deleteMediaByKeys removes R2 objects and rows', async () => {
    const row = await storeUpload(env, 'artY', new Uint8Array([9]), 'image/webp', 3000);
    await deleteMediaByKeys(env.DB, env, [row.r2_key]);
    expect(await env.MEDIA.get(row.r2_key)).toBeNull();
    expect((await listMediaByArticle(env.DB, 'artY')).length).toBe(0);
  });
});

describe('reconcile', () => {
  it('deletes unreferenced media past the grace window, keeps referenced + recent', async () => {
    const now = 100000;
    const old = now - RECONCILE_GRACE_SECONDS - 10;
    const referenced = await storeUpload(env, 'artR', new Uint8Array([1]), 'image/webp', old);
    const removed = await storeUpload(env, 'artR', new Uint8Array([2]), 'image/webp', old);
    const recent = await storeUpload(env, 'artR', new Uint8Array([3]), 'image/webp', now); // within grace
    const body = `<img src="/cms-media/${referenced.r2_key}">`;
    await reconcileArticleMedia(env.DB, env, 'artR', body, null, now);
    const keys = (await listMediaByArticle(env.DB, 'artR')).map((x) => x.r2_key).sort();
    expect(keys).toEqual([recent.r2_key, referenced.r2_key].sort()); // removed is gone
    expect(await env.MEDIA.get(removed.r2_key)).toBeNull();
  });
});

describe('cascade + gc', () => {
  it('cascade deletes all media for an article', async () => {
    const rowA = await storeUpload(env, 'artC', new Uint8Array([1]), 'image/webp', 1000);
    const rowB = await storeUpload(env, 'artC', new Uint8Array([2]), 'image/webp', 1000);
    await cascadeDeleteArticleMedia(env.DB, env, 'artC');
    expect((await listMediaByArticle(env.DB, 'artC')).length).toBe(0);
    expect(await env.MEDIA.get(rowA.r2_key)).toBeNull();
    expect(await env.MEDIA.get(rowB.r2_key)).toBeNull();
  });
  it('gc removes abandoned-draft media older than 24h with no article row', async () => {
    const now = 1_000_000;
    const oldOrphan = now - 25 * 3600;
    const ghost = await storeUpload(env, 'ghost', new Uint8Array([1]), 'image/webp', oldOrphan); // no articles row 'ghost'
    const recentOrphan = await storeUpload(env, 'ghost2', new Uint8Array([2]), 'image/webp', now - 3600);
    // a real article keeps its media — insert user BEFORE article (FK enforcement)
    await env.DB.prepare("INSERT INTO users (id,email,password_hash,password_salt,role,name,created_at) VALUES ('u','e','h','s','author','U',1)").run();
    await env.DB.prepare(
      `INSERT INTO articles (id,slug,title,body,excerpt,eyecatch_url,category_id,author_id,status,publish_at,created_at,updated_at)
       VALUES ('real','s','T','<p></p>',NULL,NULL,NULL,'u','hidden',1,1,1)`
    ).run();
    const kept = await storeUpload(env, 'real', new Uint8Array([3]), 'image/webp', oldOrphan);
    const n = await gcOrphans(env.DB, env, now);
    expect(n).toBe(1); // only the old ghost orphan
    expect((await listMediaByArticle(env.DB, 'ghost')).length).toBe(0);
    expect((await listMediaByArticle(env.DB, 'ghost2')).length).toBe(1); // too recent
    expect((await listMediaByArticle(env.DB, 'real')).length).toBe(1);   // has article
    expect(await env.MEDIA.get(ghost.r2_key)).toBeNull();
    void recentOrphan; void kept;
  });
});
