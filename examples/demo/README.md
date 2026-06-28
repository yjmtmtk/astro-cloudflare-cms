# demo — astro-cloudflare-cms example

A minimal Astro + Cloudflare Workers site that installs `astro-cloudflare-cms`
and is used as the E2E test target for the integration.

## Run locally with wrangler dev

### 1. Install workspace dependencies (from the repo root)

```bash
npm install
```

### 2. Initialize the local CMS (miniflare, no Cloudflare account required)

Run from the **repo root** (the CLI resolves wrangler config relative to cwd):

```bash
npx astro-cloudflare-cms init \
  --local \
  --yes \
  --master-email admin@example.com \
  --master-password changeme123
```

This creates a local D1 database, applies the migration, and seeds the master
account. It is idempotent — safe to re-run if interrupted.

If you already have a local D1 from a previous run you can skip this step.

### 3. Build and start

```bash
npm run build -w examples/demo
npx wrangler dev --config examples/demo/wrangler.jsonc
```

Open [http://localhost:8787/admin/login](http://localhost:8787/admin/login).

Log in with the email and password you set in step 2.

### Note: R2 / image upload requires `wrangler dev`

Image upload and media garbage collection use R2 writes which only work under
`wrangler dev`. They do **not** work under `astro dev`'s platformProxy.
Always use the build + `wrangler dev` workflow above for media features.
