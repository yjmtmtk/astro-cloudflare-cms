# astro-cloudflare-cms

Drop-in D1+R2 CMS for **Astro 7 + Cloudflare + React** sites — an Astro
integration that injects a fully self-hosted admin UI, public `/news` pages,
PBKDF2 auth, and a client-side media pipeline (D1 + R2) into an existing
static-first site. The admin UI bundles its own styles; the public `/news` pages
are themed by the host's Tailwind v4 design tokens automatically.

## Requirements

- Astro 7, `output: 'static'` (default) + the Cloudflare adapter
- `@astrojs/cloudflare` ^14 and `@astrojs/react` ^6
- React 19 (with `@astrojs/react`)
- Tailwind v4 via `@tailwindcss/vite` in the host (`@theme` token utilities)
- A Cloudflare account with D1 and R2 enabled (or `--local` for local dev)
- `compatibility_date >= 2025-09-01` and `nodejs_compat` flag in `wrangler.jsonc`

## Quickstart

**1. Install**

```bash
npm i astro-cloudflare-cms react react-dom @astrojs/react @astrojs/cloudflare
```

**2. Add the integration to `astro.config.mjs`**

Keep the host's Tailwind v4 vite plugin alongside the CMS integration:

```js
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import cms from 'astro-cloudflare-cms';

export default defineConfig({
  // output: 'static' is the default — no change needed for marketing pages
  adapter: cloudflare(),
  integrations: [react(), cms()],
  vite: {
    plugins: [tailwindcss()],
  },
});
```

**3. Run `init`**

```bash
npx astro-cloudflare-cms init
```

This single command:
- Creates (or merges bindings into) `wrangler.jsonc`
- Provisions D1 (`DB`) and R2 (`MEDIA`) — pass `--local` to skip account calls
- Applies the D1 migration
- Writes `SESSION_SECRET` to `.dev.vars`
- Seeds the master admin account
- Scaffolds `src/pages/news/index.astro` and `src/pages/news/[slug].astro`
  (thin host pages that wrap your `Layout.astro` and compose the package's
  `NewsList`/`Article` components)
- Appends a Tailwind v4 `@source` line to `src/styles/global.css` so the host's
  Tailwind build scans the package's news components and themes them with your
  `@theme` tokens

**4. Start dev**

```bash
npx astro dev
```

Open `http://localhost:4321/admin/login`. D1 and R2 are served locally by the
`@astrojs/cloudflare` v14 vite plugin — no separate `wrangler dev` needed for
local development.

## Rendering model

The CMS uses a **static-first hybrid** approach:

- The host stays `output: 'static'` — marketing pages prerender to static HTML
  as usual, with no changes required.
- CMS-injected routes (`/admin/**`, `/admin/api/**`, `/cms-media/**`) and the
  scaffolded `/news` pages export `prerender = false` and are served on-demand by
  a Cloudflare Worker.
- Deploy target is Cloudflare Workers (via `@astrojs/cloudflare`).

## News pages and theming

The package ships `NewsList`, `NewsCard`, and `Article` Astro components
(exported from `astro-cloudflare-cms/news`) written with `@theme` token utility
classes (`bg-bg`, `text-ink`, `text-muted`, `text-brand`, `bg-surface`,
`border-line`, `font-display`, `font-body`).

`init` scaffolds two thin pages into the host:

```
src/pages/news/index.astro    — imports Layout + NewsList + listPublicArticles
src/pages/news/[slug].astro   — imports Layout + Article + getPublicArticleBySlug
```

and appends one line to `src/styles/global.css`:

```css
@source "../../node_modules/astro-cloudflare-cms/src/news";
```

This causes the host's Tailwind v4 build to scan the package components and
generate the token utilities from your `@theme` block — so `/news` looks native
to your site with zero extra CSS.

**Zero-config default:** `init` looks for `src/layouts/Layout.astro` (the
web-studio convention). Override with `cms({ news: { layout: 'src/layouts/MyLayout.astro' } })`.

The scaffolded pages are yours to edit after generation. Pass `--force` to
`init` to overwrite them on re-runs.

## Options

| Option | Default | Description |
|---|---|---|
| `adminBasePath` | `/admin` | URL prefix for the admin panel |
| `newsBasePath` | `/news` | URL prefix for the public article list/detail pages |
| `brand` | `astro-cloudflare-cms` | Site name shown in the admin sidebar |
| `defaultEyecatchUrl` | `''` (empty) | Fallback eyecatch URL; empty → gradient placeholder |
| `news.layout` | `src/layouts/Layout.astro` | Path (relative to project root) to the host layout used by scaffolded news pages |

**Example with custom options:**

```js
integrations: [react(), cms({ newsBasePath: '/blog', brand: 'My Site', news: { layout: 'src/layouts/Base.astro' } })]
```

## CLI

### Setup — `init`

```bash
npx astro-cloudflare-cms init [options]
```

| Flag | Description |
|---|---|
| `--local` | Local-only setup (miniflare) — no Cloudflare account needed |
| `--db-name <name>` | D1 database name (default: `<project>-db`, derived from the directory name) |
| `--bucket-name <name>` | R2 bucket name (default: `<project>-media`, lowercased/hyphenated) |
| `--master-email <email>` | Master admin email |
| `--master-password <pass>` | Master admin password |
| `--yes` | Skip confirmation prompts |
| `--no-scaffold` | Skip scaffolding the `/news` pages |
| `--layout <path>` | Layout path for scaffolded news pages (default: `src/layouts/Layout.astro`) |
| `--force` | Overwrite existing scaffolded pages |

The `init` command is idempotent and resumable — safe to re-run if interrupted.

### User management

```bash
# Create an author with a generated password (printed once)
npx astro-cloudflare-cms create-user --email author@example.com --name "Taro" --generate

# List, reset a password, delete
npx astro-cloudflare-cms list-users
npx astro-cloudflare-cms set-password --email author@example.com --generate
npx astro-cloudflare-cms delete-user  --email author@example.com
```

| Flag | Commands | Description |
|---|---|---|
| `--email <e>` | all | Target email (or `ACC_USER_EMAIL` env) |
| `--name <n>` | create-user | Display name (default: email local part) |
| `--role author\|master` | create-user | Role (default: `author`) |
| `--password <p>` | create-user, set-password | Password (or `ACC_USER_PASSWORD` env; min 8 chars) |
| `--generate` | create-user, set-password | Generate a random password and print it once |
| `--db-name <n>` | all | D1 database name (default: read from the `DB` binding in your wrangler config) |
| `--local` | all | Target the local (miniflare) D1 instead of remote |
| `--json` | list-users | Output JSON instead of a table |
| `--yes` | all | Non-interactive (no prompts / skip the delete confirmation) |

Safety guards: duplicate emails are rejected, the last `master` cannot be
deleted, and a user that still owns articles cannot be deleted (reassign or
remove the articles first). Passwords are hashed with the same PBKDF2 routine
as the runtime, so CLI-created accounts log in immediately.

## Dev and deploy

### Local development

```bash
npx astro dev
```

`@astrojs/cloudflare` v14 serves D1 and R2 locally via the built-in vite
plugin — no separate `wrangler dev` needed.

### Production build + local preview

```bash
npm run build
npx wrangler dev --config dist/server/wrangler.json --persist-to .wrangler/state
```

`@astrojs/cloudflare` v14 emits `dist/server/wrangler.json` (not
`dist/_worker.js`). The `--persist-to` flag reuses the seeded local D1/R2
state; without it wrangler uses an empty DB and login fails.

### Deploy to Cloudflare

Before deploying, set the production session secret:

```bash
npx wrangler secret put SESSION_SECRET
```

Then deploy with `npx wrangler deploy`. The `@astrojs/cloudflare` adapter also
auto-injects `IMAGES` and `SESSION` bindings into `dist/server/wrangler.json`
(expected — they are Cloudflare adapter internals and do not conflict).

## Features

- **Roles:** master and author accounts (manage via the admin UI or the CLI)
- **Articles:** title, sanitized HTML body, category, scheduled publish date (future dates stay hidden until the date; logged-in users can preview), published/hidden status
- **Rich text editor:** Tiptap toolbar — paragraph/H2/H3, bold/italic/underline/strike, bullet & ordered lists, blockquote, link, image, divider, undo/redo — with WYSIWYG styling that matches the public article page
- **Admin UI:** two-column article editor, unified compact tables, and server-side paginated lists for articles, categories, and users; bundled styles independent of the host
- **Media:** client-side image resize to ≤ 1280 px WebP before upload; eyecatch field with gradient-placeholder fallback; orphan media reconciliation, cascade delete, and 24-hour GC
- **Routes injected:** admin panel under `adminBasePath`, internal API under `adminBasePath/api`, internal media proxy at `/cms-media/`; public `/news` is scaffolded into the host (editable)
- **Zero host-side Tailwind/shadcn config required for the admin.** The public `/news` is themed by the host's `@theme` tokens via `@source`

## Security

Self-hosted PBKDF2 password hashing (SHA-256, 100k iterations, 16-byte salt,
32-byte key, base64), opaque D1 session tokens, and a default-deny HTML
sanitizer on article bodies. In production, set a strong secret:

```bash
npx wrangler secret put SESSION_SECRET
```

## License

MIT
