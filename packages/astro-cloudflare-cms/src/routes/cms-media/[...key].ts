export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const GET: APIRoute = async ({ params }) => {
  const key = params.key;
  if (!key) return new Response('Not found', { status: 404 });
  const obj = await env.MEDIA.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  headers.set('Content-Type', obj.httpMetadata?.contentType ?? 'image/webp');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  obj.writeHttpMetadata(headers);
  return new Response(obj.body, { headers });
};
