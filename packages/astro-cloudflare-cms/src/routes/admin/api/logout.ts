import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { logout, clearedCookie, SESSION_COOKIE } from '../../../lib/auth';
import { config } from 'virtual:acc-config';

export const POST: APIRoute = async ({ request, cookies }) => {
  const sessionId = cookies.get(SESSION_COOKIE)?.value;
  if (sessionId) await logout(env.DB, sessionId);
  const secure = new URL(request.url).protocol === 'https:';
  return new Response(null, {
    status: 303,
    headers: { Location: `${config.adminBasePath}/login`, 'Set-Cookie': clearedCookie(secure) },
  });
};
