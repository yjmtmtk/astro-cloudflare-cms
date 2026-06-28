# astro-cloudflare-cms

Drop-in D1+R2 CMS for **Astro + Cloudflare + React** sites — an Astro integration
that injects a fully self-hosted admin UI, public `/news` pages, PBKDF2 auth,
and a client-side media pipeline (D1 + R2) into your existing site.
No Tailwind or shadcn installation required in the host project.

## Requirements

- Astro 5 with `output: 'server'`
- `@astrojs/cloudflare` adapter
- React 19 (with `@astrojs/react`)
- A Cloudflare account with D1 and R2 enabled
- `compatibility_date >= 2025-09-01` and `nodejs_compat` flag in `wrangler.jsonc`

## Quickstart

**1. Install**

```bash
npm i astro-cloudflare-cms
```

**2. Add the integration to `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import cms from 'astro-cloudflare-cms';

export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  integrations: [react(), cms()],
});
```

**3. Initialize, build, and run**

```bash
# Creates D1/R2 resources, merges wrangler config, applies the DB migration,
# writes SESSION_SECRET, and seeds the master account.
npx astro-cloudflare-cms init

npm run build
npx wrangler dev
```

Open `/admin/login` in your browser.

## Options

| Option | Default | Description |
|---|---|---|
| `adminBasePath` | `/admin` | URL prefix for the admin panel |
| `newsBasePath` | `/news` | URL prefix for the public article list/detail pages |
| `brand` | `astro-cloudflare-cms` | Site name shown in the admin sidebar |
| `defaultEyecatchUrl` | `''` (empty) | Fallback eyecatch URL; empty → gradient placeholder |

**Example with custom prefixes:**

```js
integrations: [react(), cms({ newsBasePath: '/blog', brand: 'My Site' })]
```

## CLI

```bash
npx astro-cloudflare-cms init [options]
```

| Flag | Description |
|---|---|
| `--local` | Local-only setup (miniflare) — no Cloudflare account needed |
| `--db-name <name>` | D1 database name (default: `cms-db`) |
| `--bucket-name <name>` | R2 bucket name (default: `cms-media`) |
| `--master-email <email>` | Master admin email |
| `--master-password <pass>` | Master admin password |
| `--yes` | Skip confirmation prompts |

The `init` command is idempotent and resumable — safe to re-run if interrupted.

## Important: use `wrangler dev` for media

Image upload and orphan media garbage collection require **`npx wrangler dev`**.
R2 writes do not work under `astro dev`'s platformProxy. Run a production build
first (`npm run build`) then use `wrangler dev`.

## Features

- **Roles:** master and author accounts
- **Articles:** title, sanitized HTML body, category, scheduled publish date (future dates stay hidden until the date; logged-in users can preview), published/hidden status
- **Media:** client-side image resize to ≤ 1280 px WebP before upload; eyecatch field with gradient-placeholder fallback; orphan media reconciliation, cascade delete, and 24-hour GC
- **Routes injected:** admin panel under `adminBasePath`, public news under `newsBasePath`, internal media proxy at `/cms-media/`
- **No host dependencies:** styles are bundled into `styles.css`; Radix UI and Tiptap are package dependencies

## Security

Self-hosted PBKDF2 password hashing, opaque D1 session tokens, and a default-deny
HTML sanitizer on article bodies. In production, set a strong secret:

```bash
npx wrangler secret put SESSION_SECRET
```
