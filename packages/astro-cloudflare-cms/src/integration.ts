import type { AstroIntegration } from 'astro';
import { fileURLToPath } from 'node:url';
import { resolveOptions, type CmsOptions } from './options';
import type { AccConfig } from './config-runtime';

function virtualConfigPlugin(cfg: AccConfig) {
  const id = 'virtual:acc-config';
  const resolved = '\0' + id;
  return {
    name: 'acc:virtual-config',
    resolveId(source: string) { return source === id ? resolved : null; },
    load(thisId: string) { return thisId === resolved ? `export const config = ${JSON.stringify(cfg)};` : null; },
  };
}

export default function cms(options: CmsOptions = {}): AstroIntegration {
  const o = resolveOptions(options);
  const cfg: AccConfig = {
    adminBasePath: o.adminBasePath,
    newsBasePath: o.newsBasePath,
    brand: o.brand,
    defaultEyecatchUrl: o.defaultEyecatchUrl,
  };
  const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
  return {
    name: 'astro-cloudflare-cms',
    hooks: {
      'astro:config:setup': ({ addMiddleware, updateConfig, injectRoute, logger }) => {
        updateConfig({ vite: { plugins: [virtualConfigPlugin(cfg)] } });
        addMiddleware({ entrypoint: here('./middleware.ts'), order: 'pre' });
        const admin = o.adminBasePath;
        injectRoute({ pattern: `${admin}/api/login`,  entrypoint: here('./routes/admin/api/login.ts') });
        injectRoute({ pattern: `${admin}/api/logout`, entrypoint: here('./routes/admin/api/logout.ts') });
        injectRoute({ pattern: `${admin}/api/upload`, entrypoint: here('./routes/admin/api/upload.ts') });
        injectRoute({ pattern: `${admin}/api/articles`,      entrypoint: here('./routes/admin/api/articles/index.ts') });
        injectRoute({ pattern: `${admin}/api/articles/[id]`, entrypoint: here('./routes/admin/api/articles/[id].ts') });
        injectRoute({ pattern: `${admin}/api/categories`,      entrypoint: here('./routes/admin/api/categories/index.ts') });
        injectRoute({ pattern: `${admin}/api/categories/[id]`, entrypoint: here('./routes/admin/api/categories/[id].ts') });
        injectRoute({ pattern: `${admin}/api/users`,      entrypoint: here('./routes/admin/api/users/index.ts') });
        injectRoute({ pattern: `${admin}/api/users/[id]`, entrypoint: here('./routes/admin/api/users/[id].ts') });
        injectRoute({ pattern: `/cms-media/[...key]`, entrypoint: here('./routes/cms-media/[...key].ts') });
        injectRoute({ pattern: o.adminBasePath,                        entrypoint: here('./routes/admin/index.astro') });
        injectRoute({ pattern: `${o.adminBasePath}/login`,             entrypoint: here('./routes/admin/login.astro') });
        injectRoute({ pattern: `${o.adminBasePath}/categories`,        entrypoint: here('./routes/admin/categories.astro') });
        injectRoute({ pattern: `${o.adminBasePath}/users`,             entrypoint: here('./routes/admin/users.astro') });
        injectRoute({ pattern: `${o.adminBasePath}/articles/new`,      entrypoint: here('./routes/admin/articles/new.astro') });
        injectRoute({ pattern: `${o.adminBasePath}/articles/[id]`,     entrypoint: here('./routes/admin/articles/[id].astro') });
        injectRoute({ pattern: o.newsBasePath,                         entrypoint: here('./routes/news/index.astro') });
        injectRoute({ pattern: `${o.newsBasePath}/[slug]`,             entrypoint: here('./routes/news/[slug].astro') });
        logger.info(`astro-cloudflare-cms: middleware + virtual config ready (admin=${o.adminBasePath})`);
      },
      'astro:config:done': ({ injectTypes }) => {
        injectTypes({
          filename: 'astro-cloudflare-cms.d.ts',
          content: [
            "import type { SessionUser } from 'astro-cloudflare-cms/types';",
            'declare namespace App {',
            '  interface Locals {',
            '    runtime: { env: { DB: D1Database; MEDIA: R2Bucket; SESSION_SECRET: string; PUBLIC_R2_BASE_URL?: string; DEFAULT_EYECATCH_URL?: string } };',
            '    user: SessionUser | null;',
            '  }',
            '}',
          ].join('\n'),
        });
      },
    },
  };
}
