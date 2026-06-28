import type { APIRoute } from 'astro';
import { canManageArticle } from '../../../../lib/authz';
import { getArticleById, updateArticle, deleteArticle, slugExists } from '../../../../lib/db-articles';
import { ensureSlug } from '../../../../lib/slug';
import type { ArticleStatus } from '../../../../lib/types';
import { reconcileArticleMedia, cascadeDeleteArticleMedia, gcOrphans } from '../../../../lib/media';

export const GET: APIRoute = async ({ locals, params }) => {
  const db = locals.runtime.env.DB;
  const article = await getArticleById(db, params.id!);
  if (!article) return new Response('Not found', { status: 404 });
  if (!canManageArticle(locals.user, article)) return new Response('Forbidden', { status: 403 });
  return Response.json(article);
};

export const PUT: APIRoute = async ({ locals, params, request }) => {
  const env = locals.runtime.env;
  const db = env.DB;
  const id = params.id!;
  const article = await getArticleById(db, id);
  if (!article) return new Response('Not found', { status: 404 });
  if (!canManageArticle(locals.user, article)) return new Response('Forbidden', { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response('invalid JSON', { status: 400 });
  }
  const title = String(body.title ?? article.title).trim();
  const status: ArticleStatus = body.status !== undefined ? (body.status === 'published' ? 'published' : 'hidden') : article.status;
  const now = Math.floor(Date.now() / 1000);
  const publish_at = Number.isFinite(body.publish_at) ? Number(body.publish_at) : article.publish_at;

  let slug = ensureSlug((body.slug as string) || title);
  if (await slugExists(db, slug, id)) slug = `${slug}-${ensureSlug('')}`;

  try {
    await updateArticle(db, id, {
      slug,
      title,
      body: body.body !== undefined ? String(body.body) : article.body,
      excerpt: body.excerpt !== undefined ? (body.excerpt ? String(body.excerpt) : null) : article.excerpt,
      eyecatch_url: body.eyecatch_url !== undefined ? (body.eyecatch_url ? String(body.eyecatch_url) : null) : article.eyecatch_url,
      category_id: body.category_id !== undefined ? (body.category_id ? String(body.category_id) : null) : article.category_id,
      status,
      publish_at,
      updated_at: now,
    });
  } catch (e) {
    if (e instanceof Error && e.message.includes('UNIQUE constraint failed')) {
      return new Response('slug already exists', { status: 409 });
    }
    if (e instanceof Error && e.message.includes('FOREIGN KEY constraint failed')) {
      return new Response('invalid category', { status: 400 });
    }
    throw e;
  }
  const updated = await getArticleById(db, id);
  await reconcileArticleMedia(db, env, id, updated!.body, updated!.eyecatch_url, now);
  await gcOrphans(db, env, now);
  return Response.json(updated);
};

export const DELETE: APIRoute = async ({ locals, params }) => {
  const env = locals.runtime.env;
  const db = env.DB;
  const article = await getArticleById(db, params.id!);
  if (!article) return new Response(null, { status: 204 });
  if (!canManageArticle(locals.user, article)) return new Response('Forbidden', { status: 403 });
  await cascadeDeleteArticleMedia(db, env, params.id!);
  await deleteArticle(db, params.id!);
  return new Response(null, { status: 204 });
};
