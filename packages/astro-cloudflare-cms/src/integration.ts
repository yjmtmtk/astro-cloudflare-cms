import type { AstroIntegration } from 'astro';
import { fileURLToPath } from 'node:url';
import { resolveOptions, type CmsOptions } from './options';

export default function cms(options: CmsOptions = {}): AstroIntegration {
  const opts = resolveOptions(options);
  return {
    name: 'astro-cloudflare-cms',
    hooks: {
      'astro:config:setup': ({ injectRoute, logger }) => {
        injectRoute({
          pattern: `${opts.adminBasePath}/_health`,
          entrypoint: fileURLToPath(new URL('./routes/_health.ts', import.meta.url)),
        });
        logger.info(`astro-cloudflare-cms: routes injected under ${opts.adminBasePath}`);
      },
    },
  };
}
