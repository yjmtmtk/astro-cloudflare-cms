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

# Run the package test suite (82 tests via Vitest + cloudflare pool)
npm test

# Rebuild the bundled CSS (Tailwind → styles.css)
npm run build:css -w astro-cloudflare-cms

# Build the demo app
npm run build -w examples/demo
```

## Links

- [Package README](./packages/astro-cloudflare-cms/README.md) — quickstart, options, CLI flags
- [Design spec](./docs/superpowers/specs/) — architecture and data model
- [Build plans](./docs/superpowers/plans/) — stage-by-stage implementation plans
