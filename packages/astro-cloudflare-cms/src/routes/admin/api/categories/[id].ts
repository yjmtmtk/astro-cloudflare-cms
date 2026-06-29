import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isMaster } from '../../../../lib/authz';
import { getCategory, updateCategory, deleteCategory } from '../../../../lib/db-categories';
import { ensureSlug } from '../../../../lib/slug';

export const PUT: APIRoute = async ({ locals, params, request }) => {
  if (!isMaster(locals.user)) return new Response('Forbidden', { status: 403 });
  const db = env.DB;
  const id = params.id!;
  const existing = await getCategory(db, id);
  if (!existing) return new Response('Not found', { status: 404 });
  let body: { name?: string; slug?: string; sort_order?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response('invalid JSON', { status: 400 });
  }
  const name = (body.name ?? existing.name).trim();
  const slug = ensureSlug(body.slug || name);
  const sort_order = Number.isFinite(body.sort_order) ? Number(body.sort_order) : existing.sort_order;
  try {
    await updateCategory(db, id, { slug, name, sort_order });
  } catch (e) {
    if (e instanceof Error && e.message.includes('UNIQUE constraint failed')) {
      return new Response('slug already exists', { status: 409 });
    }
    throw e;
  }
  return Response.json({ id, slug, name, sort_order, created_at: existing.created_at });
};

export const DELETE: APIRoute = async ({ locals, params }) => {
  if (!isMaster(locals.user)) return new Response('Forbidden', { status: 403 });
  await deleteCategory(env.DB, params.id!);
  return new Response(null, { status: 204 });
};
