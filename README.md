# astro-cloudflare-cms

A Cloudflare-native CMS for **Astro + Cloudflare Workers + React** sites,
shipped as an Astro Integration. Add `cms()` to your `astro.config` and it
injects the admin UI, public `/news` pages, API routes, and image pipeline
(D1 + R2) into an existing site.

See [`packages/astro-cloudflare-cms/README.md`](./packages/astro-cloudflare-cms/README.md)
for full installation, options, and CLI documentation.

## Monorepo layout

```
packages/
  astro-cloudflare-cms/   — the publishable npm integration (+ CLI)
examples/
  demo/                   — demo Astro + Cloudflare host used for E2E testing
docs/
  superpowers/            — design spec and build plans
```

## Dev commands

```bash
# Install all workspace dependencies
npm install

# Run the package test suite (106 tests via Vitest + cloudflare pool)
npm test

# Rebuild the bundled CSS (Tailwind → styles.css)
npm run build:css -w astro-cloudflare-cms

# Build the demo app
npm run build -w examples/demo
```

## Local development

Use `wrangler dev` — R2 writes (image upload, media GC) do **not** work under
`astro dev`'s platformProxy:

```bash
npm run build -w examples/demo
cd examples/demo && npx wrangler dev   # then open /admin/login
```

The demo's local D1/R2 live in `examples/demo/.wrangler/` (gitignored) with a
seeded master account. After changing package source, clear the demo's caches
before rebuilding: `rm -rf examples/demo/{dist,.astro,node_modules/.vite}`.

## Design rules (non-negotiable)

The package ships **TypeScript source** that the host's Astro/Vite build compiles,
so a few constraints must hold:

1. **Relative imports only** in runtime files (`routes/`, `components/`, `middleware.ts`, `lib/`). No `@/` alias — it would resolve to the *host's* `src`. (`@/` is for tests only.)
2. **Paths come from `virtual:acc-config`** (`config.adminBasePath` / `newsBasePath` / `brand`). Never hard-code `/admin` or `/news`. (`/cms-media` is the one fixed internal path.)
3. **Admin shell is `client:only="react"`** to avoid a React #418 hydration mismatch. Public `/news` pages stay SSR (SEO).
4. **CSS is pre-built and bundled** into `styles.css`. After changing component classes, run `npm run build:css -w astro-cloudflare-cms` and commit. Uses `@tailwindcss/typography` — `prose` styles the editor body *and* public articles, so don't remove it.
5. **CLI password hashing stays byte-identical to `src/lib/auth.ts`** (PBKDF2 / SHA-256 / 100k / 16-byte salt / 32-byte key / base64); `test/cli-crypto.test.ts` asserts parity.
6. **Fixed bindings:** D1 = `DB`, R2 = `MEDIA`; env via `locals.runtime.env`. Requires `compatibility_date >= 2025-09-01` + `nodejs_compat`.
7. **`media` has no FK to articles** (uploads precede the row). Delete order is DB → R2; orphans are cleaned by reconcile (300 s grace) / cascade / 24-hour GC.

## Testing

`npm test` runs Vitest on `@cloudflare/vitest-pool-workers` (miniflare provides
in-memory D1/R2). Notes:

- A teardown bug is fixed by `patches/@cloudflare+vitest-pool-workers+0.6.16.patch`,
  applied via `postinstall: patch-package` in the **root** `package.json` (the dep
  hoists to the root `node_modules`).
- The miniflare compatibility date is `2025-02-04` (miniflare's ceiling) — separate
  from the production runtime's `2025-09-01`.
- CLI helper logic is unit-tested; the parts that shell out to `wrangler` are
  verified manually against the demo's local D1.

## Known limitations

- The CLI's **remote path** (real Cloudflare `d1 create` / `secret put` / `--remote`)
  has not been exercised end-to-end — only the `--local` path is verified.
- Merging `wrangler.jsonc` drops comments (it is re-serialized jsonc → JSON).
- `wrangler.toml` is not auto-edited; `init` prints the lines to add manually.

## Links

- [Package README](./packages/astro-cloudflare-cms/README.md) — quickstart, options, CLI flags
- [Design spec](./docs/superpowers/specs/) — architecture and data model
- [Build plans](./docs/superpowers/plans/) — stage-by-stage implementation plans
