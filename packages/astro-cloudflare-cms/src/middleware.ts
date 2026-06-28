import { defineMiddleware } from 'astro:middleware';
import { config } from 'virtual:acc-config';
import { resolveSession, SESSION_COOKIE } from './lib/auth';

export function isProtectedAdminPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/';
  const publicAdminPaths = new Set([`${config.adminBasePath}/login`, `${config.adminBasePath}/api/login`]);
  if (publicAdminPaths.has(p)) return false;
  return p === config.adminBasePath || p.startsWith(config.adminBasePath + '/');
}

export const onRequest = defineMiddleware(async (context, next) => {
  const env = context.locals.runtime.env;
  const sessionId = context.cookies.get(SESSION_COOKIE)?.value ?? null;
  const now = Math.floor(Date.now() / 1000);
  context.locals.user = sessionId ? await resolveSession(env.DB, sessionId, now) : null;

  if (isProtectedAdminPath(context.url.pathname) && !context.locals.user) {
    return context.redirect(`${config.adminBasePath}/login`);
  }
  return next();
});
