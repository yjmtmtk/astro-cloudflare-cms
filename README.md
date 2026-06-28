# astro-cloudflare-cms

A tiny, Cloudflare-native CMS for existing **Astro + Cloudflare (Workers) + React** sites,
shipped as an **Astro Integration** (npm package). Add `cms()` to your `astro.config` and it
injects the admin UI, public `/news` pages, API routes, and image pipeline (D1 + R2).

## Monorepo layout

- `packages/astro-cloudflare-cms/` — the publishable integration (+ CLI).
- `examples/demo/` — a demo Astro + Cloudflare host that installs the package and is used for E2E.

See `docs/superpowers/specs/` for the design and `docs/superpowers/plans/` for the build plans.
