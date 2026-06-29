import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import cms from 'astro-cloudflare-cms';
import tailwindcss from '@tailwindcss/vite';

// In this monorepo, root node_modules has tailwindcss v3 (used by the package).
// @tailwindcss/vite bundles its own v4 — hard-code the path so Vite picks v4
// for both client + server (rolldown) builds.
// Real npm-installed hosts don't need this alias (no v3/v4 conflict).
const tw4path =
  new URL('../../../node_modules/@tailwindcss/vite/node_modules/tailwindcss', import.meta.url)
    .pathname;

export default defineConfig({
  // static-first: marketing pages prerender; CMS routes opt into SSR via
  // `export const prerender = false` (see the integration's injected routes).
  output: 'static',
  adapter: cloudflare(),
  integrations: [react(), cms()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        tailwindcss: tw4path,
      },
    },
  },
});
