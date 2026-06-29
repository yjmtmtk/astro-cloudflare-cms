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

### Setup — `init`

```bash
npx astro-cloudflare-cms init [options]
```

| Flag | Description |
|---|---|
| `--local` | Local-only setup (miniflare) — no Cloudflare account needed |
| `--db-name <name>` | D1 database name (default: `<project>-db`, derived from the directory name) |
| `--bucket-name <name>` | R2 bucket name (default: `<project>-media`, lowercased/hyphenated for R2) |
| `--master-email <email>` | Master admin email |
| `--master-password <pass>` | Master admin password |
| `--yes` | Skip confirmation prompts |

The `init` command is idempotent and resumable — safe to re-run if interrupted.

### User management

Manage users from the command line — handy for headless/bootstrap or scripted
setups. (Master accounts can also do full user CRUD from the admin UI.)

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

Safety guards: duplicate emails are rejected, the last `master` cannot be deleted,
and a user that still owns articles cannot be deleted (reassign or remove the
articles first). Passwords are hashed with the same PBKDF2 routine as the runtime,
so CLI-created accounts log in immediately.

## Important: use `wrangler dev` for media

Image upload and orphan media garbage collection require **`npx wrangler dev`**.
R2 writes do not work under `astro dev`'s platformProxy. Run a production build
first (`npm run build`) then use `wrangler dev`.

## Features

- **Roles:** master and author accounts (manage via the admin UI or the CLI)
- **Articles:** title, sanitized HTML body, category, scheduled publish date (future dates stay hidden until the date; logged-in users can preview), published/hidden status
- **Rich text editor:** Tiptap toolbar — paragraph/H2/H3, bold/italic/underline/strike, bullet & ordered lists, blockquote, link, image, divider, undo/redo — with WYSIWYG styling that matches the public article page
- **Admin UI:** two-column article editor, unified compact tables, and server-side paginated lists for articles, categories, and users
- **Media:** client-side image resize to ≤ 1280 px WebP before upload; eyecatch field with gradient-placeholder fallback; orphan media reconciliation, cascade delete, and 24-hour GC
- **Routes injected:** admin panel under `adminBasePath`, public news under `newsBasePath`, internal media proxy at `/cms-media/`
- **No host dependencies:** styles are bundled into `styles.css`; Radix UI and Tiptap are package dependencies

## Security

Self-hosted PBKDF2 password hashing, opaque D1 session tokens, and a default-deny
HTML sanitizer on article bodies. In production, set a strong secret:

```bash
npx wrangler secret put SESSION_SECRET
```

## License

MIT
