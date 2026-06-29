export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { canCreateArticle, isMaster } from '../../../../lib/authz';
import { listArticles, countArticles, insertArticle, slugExists } from '../../../../lib/db-articles';
import { parsePage } from '../../../../lib/pagination';
import { ensureSlug } from '../../../../lib/slug';
import type { ArticleStatus } from '../../../../lib/types';
import { reconcileArticleMedia, gcOrphans } from '../../../../lib/media';

function normStatus(v: string | null): ArticleStatus | undefined {
  return v === 'published' || v === 'hidden' ? v : undefined;
}

export const GET: APIRoute = async ({ locals, url }) => {
  const user = locals.user;
  if (!user) return new Response('Forbidden', { status: 403 });
  const db = env.DB;
  const authorId = isMaster(user) ? url.searchParams.get('author') ?? undefined : user.id;
  const filter = {
    status: normStatus(url.searchParams.get('status')),
    categoryId: url.searchParams.get('category') ?? undefined,
    q: url.searchParams.get('q') ?? undefined,
    authorId,
  };
  const pg = parsePage(url);
  if (!pg) {
    return Response.json(await listArticles(db, filter));
  }
  const [items, total] = await Promise.all([
    listArticles(db, { ...filter, limit: pg.pageSize, offset: pg.offset }),
    countArticles(db, filter),
  ]);
  return Response.json({ items, total, page: pg.page, pageSize: pg.pageSize });
};

export const POST: APIRoute = async ({ locals, request }) => {
  const user = locals.user;
  if (!canCreateArticle(user)) return new Response('Forbidden', { status: 403 });
  const db = env.DB;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response('invalid JSON', { status: 400 });
  }
  const title = String(body.title ?? '').trim();
  if (!title) return new Response('title required', { status: 400 });
  const status: ArticleStatus = body.status === 'published' ? 'published' : 'hidden';
  const now = Math.floor(Date.now() / 1000);
  const publish_at = Number.isFinite(body.publish_at) ? Number(body.publish_at) : now;

  let slug = ensureSlug((body.slug as string) || title);
  if (await slugExists(db, slug)) slug = `${slug}-${ensureSlug('')}`;

  // master may assign author; otherwise author is the current user
  const author_id = isMaster(user!) && typeof body.author_id === 'string' ? body.author_id : user!.id;

  const row = {
    id: typeof body.id === 'string' && body.id.length > 0 ? body.id : crypto.randomUUID(),
    slug,
    title,
    body: String(body.body ?? ''),
    excerpt: body.excerpt ? String(body.excerpt) : null,
    eyecatch_url: body.eyecatch_url ? String(body.eyecatch_url) : null,
    category_id: body.category_id ? String(body.category_id) : null,
    author_id,
    status,
    publish_at,
    created_at: now,
    updated_at: now,
  };
  try {
    await insertArticle(db, row);
    await reconcileArticleMedia(db, env, row.id, row.body, row.eyecatch_url, now);
    await gcOrphans(db, env, now);
  } catch (e) {
    if (e instanceof Error && e.message.includes('UNIQUE constraint failed')) {
      return new Response('slug already exists', { status: 409 });
    }
    if (e instanceof Error && e.message.includes('FOREIGN KEY constraint failed')) {
      return new Response('invalid category', { status: 400 });
    }
    throw e;
  }
  return Response.json(row, { status: 201 });
};
