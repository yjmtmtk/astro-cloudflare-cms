import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import cms from 'astro-cloudflare-cms';

export default defineConfig({
  // static-first: marketing pages prerender; CMS routes opt into SSR via
  // `export const prerender = false` (see the integration's injected routes).
  output: 'static',
  adapter: cloudflare(),
  integrations: [react(), cms()],
});
