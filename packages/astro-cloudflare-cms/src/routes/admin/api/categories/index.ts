export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isMaster } from '../../../../lib/authz';
import { listCategories, countCategories, insertCategory } from '../../../../lib/db-categories';
import { parsePage } from '../../../../lib/pagination';
import { ensureSlug } from '../../../../lib/slug';

export const GET: APIRoute = async ({ locals, url }) => {
  if (locals.user === null) return new Response('Forbidden', { status: 403 });
  const db = env.DB;
  const pg = parsePage(url);
  if (!pg) {
    return Response.json(await listCategories(db));
  }
  const [items, total] = await Promise.all([
    listCategories(db, { limit: pg.pageSize, offset: pg.offset }),
    countCategories(db),
  ]);
  return Response.json({ items, total, page: pg.page, pageSize: pg.pageSize });
};

export const POST: APIRoute = async ({ locals, request }) => {
  if (!isMaster(locals.user)) return new Response('Forbidden', { status: 403 });
  let body: { name?: string; slug?: string; sort_order?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response('invalid JSON', { status: 400 });
  }
  const name = (body.name ?? '').trim();
  if (!name) return new Response('name required', { status: 400 });
  const now = Math.floor(Date.now() / 1000);
  const row = {
    id: crypto.randomUUID(),
    slug: ensureSlug(body.slug || name),
    name,
    sort_order: Number.isFinite(body.sort_order) ? Number(body.sort_order) : 0,
    created_at: now,
  };
  try {
    await insertCategory(env.DB, row);
  } catch (e) {
    if (e instanceof Error && e.message.includes('UNIQUE constraint failed')) {
      return new Response('slug already exists', { status: 409 });
    }
    throw e;
  }
  return Response.json(row, { status: 201 });
};
