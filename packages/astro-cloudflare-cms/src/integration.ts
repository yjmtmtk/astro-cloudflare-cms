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
      'astro:config:setup': ({ addMiddleware, updateConfig, logger }) => {
        updateConfig({ vite: { plugins: [virtualConfigPlugin(cfg)] } });
        addMiddleware({ entrypoint: here('./middleware.ts'), order: 'pre' });
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
