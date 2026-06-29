export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { login, cookieAttributes } from '../../../lib/auth';
import { config } from 'virtual:acc-config';

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const email = String(form.get('email') ?? '');
  const password = String(form.get('password') ?? '');
  const now = Math.floor(Date.now() / 1000);
  const secure = new URL(request.url).protocol === 'https:';

  const result = await login(env.DB, email, password, now);
  if (!result) {
    return new Response(null, { status: 303, headers: { Location: `${config.adminBasePath}/login?error=1` } });
  }
  return new Response(null, {
    status: 303,
    headers: {
      Location: config.adminBasePath,
      'Set-Cookie': cookieAttributes(result.sessionId, result.expiresAt, now, secure),
    },
  });
};
