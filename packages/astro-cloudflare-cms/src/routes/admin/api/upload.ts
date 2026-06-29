import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { storeUpload } from '../../../lib/media';

export const POST: APIRoute = async ({ locals, request }) => {
  if (!locals.user) return new Response('Forbidden', { status: 403 });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response('expected multipart form', { status: 400 });
  }
  const file = form.get('file');
  const articleId = String(form.get('articleId') ?? '');
  if (!articleId || articleId.length > 100) return new Response('invalid articleId', { status: 400 });
  if (!(file instanceof File)) return new Response('file required', { status: 400 });
  if (file.size > 10 * 1024 * 1024) return new Response('file too large', { status: 413 });
  if (file.type !== 'image/webp') return new Response('only image/webp accepted', { status: 415 });
  const bytes = await file.arrayBuffer();
  const now = Math.floor(Date.now() / 1000);
  const row = await storeUpload(env, articleId, bytes, 'image/webp', now);
  return Response.json({ key: row.r2_key, url: row.url }, { status: 201 });
};
