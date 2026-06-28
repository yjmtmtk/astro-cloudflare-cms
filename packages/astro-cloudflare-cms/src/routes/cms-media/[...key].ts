import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params, locals }) => {
  const key = params.key;
  if (!key) return new Response('Not found', { status: 404 });
  const obj = await locals.runtime.env.MEDIA.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  headers.set('Content-Type', obj.httpMetadata?.contentType ?? 'image/webp');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  obj.writeHttpMetadata(headers);
  return new Response(obj.body, { headers });
};
