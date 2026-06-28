# astro-cloudflare-cms — Plan 1: Monorepo Skeleton + Integration + Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use `- [ ]` checkboxes.

**Goal:** Stand up the `astro-cloudflare-cms` monorepo (npm workspaces) with the publishable integration package and an `examples/demo` host, where `cms()` is a real Astro Integration that injects a route into the demo — proving the end-to-end injection mechanism (validated earlier in a throwaway POC) in the actual repo structure.

**Architecture:** npm workspaces with `packages/astro-cloudflare-cms` (the integration; default export is `cms(options)` returning an `AstroIntegration`) and `examples/demo` (a minimal Astro + Cloudflare host that installs the package via the workspace link and adds `cms()` to its config). For Stage 1 the integration injects a single health endpoint under the configurable `adminBasePath`; later stages add the real routes/middleware/UI/CLI. The integration runs from TypeScript source (Astro/Vite transpiles it); a dist build step is deferred to a later stage.

**Tech Stack:** npm workspaces, Astro 5, `@astrojs/cloudflare`, `@astrojs/react`, React 19, TypeScript (moduleResolution `bundler`), vitest (plain node for now; the Cloudflare workers pool arrives in Stage 2).

## Global Constraints

- **Project / package name:** `astro-cloudflare-cms` (repo, npm package, integration `name`).
- **wrangler:** always `npx wrangler ...`; never a dependency, never global.
- **Bindings:** D1 = `DB`, R2 = `MEDIA` (declared in the demo's wrangler config; unused until later stages).
- **Adapter:** demo uses `@astrojs/cloudflare` with `output: 'server'` and `platformProxy.enabled: true`.
- **compatibility_date:** `2025-09-01` (+ `nodejs_compat`) in the demo's wrangler config (React 19 SSR).
- **Path options normalize** to a leading slash with no trailing slash (`/admin`, not `admin/` or `/admin/`).
- **No absolute machine paths** in committed files. Integration resolves its own route entrypoints via `import.meta.url`.
- **Self-contained:** the demo depends on the package via the workspace (`"astro-cloudflare-cms": "*"`), resolved by npm workspaces.

---

## File Structure (Plan 1 scope)

- Create: `package.json` — monorepo root (private, `workspaces: ["packages/*", "examples/*"]`)
- Create: `README.md` — one-paragraph repo intro (what it is, monorepo layout)
- Create: `packages/astro-cloudflare-cms/package.json` — the package manifest (name, exports, peerDeps, scripts)
- Create: `packages/astro-cloudflare-cms/tsconfig.json` — TS config (bundler resolution)
- Create: `packages/astro-cloudflare-cms/src/options.ts` — `CmsOptions`, `ResolvedCmsOptions`, `resolveOptions()`
- Create: `packages/astro-cloudflare-cms/src/integration.ts` — `export default cms(options)`
- Create: `packages/astro-cloudflare-cms/src/routes/_health.ts` — injected health endpoint
- Create: `packages/astro-cloudflare-cms/vitest.config.ts` — plain node vitest
- Create: `packages/astro-cloudflare-cms/test/options.test.ts` — `resolveOptions` unit tests
- Create: `examples/demo/package.json` — demo host manifest (workspace dep on the package)
- Create: `examples/demo/astro.config.mjs` — react + cloudflare + `cms()`
- Create: `examples/demo/wrangler.jsonc` — bindings/compat
- Create: `examples/demo/tsconfig.json`
- Create: `examples/demo/src/pages/index.astro` — host home page

---

### Task 1: Integration package (options TDD + `cms()` injecting a health route)

**Files:**
- Create: `package.json` (root)
- Create: `README.md`
- Create: `packages/astro-cloudflare-cms/package.json`
- Create: `packages/astro-cloudflare-cms/tsconfig.json`
- Create: `packages/astro-cloudflare-cms/src/options.ts`
- Create: `packages/astro-cloudflare-cms/src/routes/_health.ts`
- Create: `packages/astro-cloudflare-cms/src/integration.ts`
- Create: `packages/astro-cloudflare-cms/vitest.config.ts`
- Create: `packages/astro-cloudflare-cms/test/options.test.ts`

**Interfaces:**
- Produces:
  - `CmsOptions` (all optional): `{ adminBasePath?, newsBasePath?, mediaBasePath?, brand?, defaultEyecatchUrl? }: string`
  - `ResolvedCmsOptions` (all required strings, same keys)
  - `resolveOptions(o?: CmsOptions): ResolvedCmsOptions` — fills defaults (`/admin`, `/news`, `/cms-media`, `astro-cloudflare-cms`, `''`) and normalizes each path to a leading slash with no trailing slash.
  - `default export cms(options?: CmsOptions): AstroIntegration` — name `astro-cloudflare-cms`; on `astro:config:setup` injects a GET route at `${adminBasePath}/_health`.

- [ ] **Step 1: Root monorepo manifest** — `package.json`

```json
{
  "name": "astro-cloudflare-cms-monorepo",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*", "examples/*"],
  "scripts": {
    "test": "npm run test -w astro-cloudflare-cms",
    "build:demo": "npm run build -w examples/demo"
  }
}
```

- [ ] **Step 2: Root README** — `README.md`

```markdown
# astro-cloudflare-cms

A tiny, Cloudflare-native CMS for existing **Astro + Cloudflare (Workers) + React** sites,
shipped as an **Astro Integration** (npm package). Add `cms()` to your `astro.config` and it
injects the admin UI, public `/news` pages, API routes, and image pipeline (D1 + R2).

## Monorepo layout

- `packages/astro-cloudflare-cms/` — the publishable integration (+ CLI).
- `examples/demo/` — a demo Astro + Cloudflare host that installs the package and is used for E2E.

See `docs/superpowers/specs/` for the design and `docs/superpowers/plans/` for the build plans.
```

- [ ] **Step 3: Package manifest** — `packages/astro-cloudflare-cms/package.json`

```json
{
  "name": "astro-cloudflare-cms",
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": "./src/integration.ts"
  },
  "files": ["src", "migrations", "styles.css", "bin"],
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "peerDependencies": {
    "astro": "^5"
  },
  "devDependencies": {
    "astro": "^5.0.0",
    "typescript": "^5.6.0",
    "vitest": "~2.1.0"
  }
}
```
> Note: `exports` points at the TypeScript source. Astro loads `astro.config` via a TS-aware loader and Vite transpiles the integration + injected entrypoints, so no build step is needed to consume the package from the workspace. A `dist` build is added in a later stage before publishing.

- [ ] **Step 4: Package tsconfig** — `packages/astro-cloudflare-cms/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": ["@cloudflare/workers-types"],
    "verbatimModuleSyntax": true,
    "noEmit": true
  },
  "include": ["src", "test"]
}
```
> `@cloudflare/workers-types` is pulled transitively via `@astrojs/cloudflare` in the demo; for the package's own typecheck it is optional in Stage 1 (the health route only uses the Web `Response`). If `tsc` complains about the missing types package here, drop the `"types"` line — Stage 2 adds it explicitly with the DB code.

- [ ] **Step 5: Write the failing options test** — `packages/astro-cloudflare-cms/test/options.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { resolveOptions } from '../src/options';

describe('resolveOptions', () => {
  it('fills defaults when nothing is passed', () => {
    expect(resolveOptions()).toEqual({
      adminBasePath: '/admin',
      newsBasePath: '/news',
      mediaBasePath: '/cms-media',
      brand: 'astro-cloudflare-cms',
      defaultEyecatchUrl: '',
    });
  });

  it('normalizes paths to a leading slash with no trailing slash', () => {
    const r = resolveOptions({ adminBasePath: 'cms/', newsBasePath: '/blog/', mediaBasePath: 'media' });
    expect(r.adminBasePath).toBe('/cms');
    expect(r.newsBasePath).toBe('/blog');
    expect(r.mediaBasePath).toBe('/media');
  });

  it('passes through brand and defaultEyecatchUrl', () => {
    const r = resolveOptions({ brand: 'My CMS', defaultEyecatchUrl: 'https://x/d.png' });
    expect(r.brand).toBe('My CMS');
    expect(r.defaultEyecatchUrl).toBe('https://x/d.png');
  });
});
```

- [ ] **Step 6: vitest config** — `packages/astro-cloudflare-cms/vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['test/**/*.test.ts'] },
});
```

- [ ] **Step 7: Install workspaces and run the test to verify it FAILS**

Run:
```bash
npm install
npm run test -w astro-cloudflare-cms
```
Expected: FAIL — cannot resolve `../src/options` (file not created yet).

- [ ] **Step 8: Implement `packages/astro-cloudflare-cms/src/options.ts`**

```ts
export interface CmsOptions {
  adminBasePath?: string;
  newsBasePath?: string;
  mediaBasePath?: string;
  brand?: string;
  defaultEyecatchUrl?: string;
}

export interface ResolvedCmsOptions {
  adminBasePath: string;
  newsBasePath: string;
  mediaBasePath: string;
  brand: string;
  defaultEyecatchUrl: string;
}

function normalizePath(p: string): string {
  return '/' + p.replace(/^\/+|\/+$/g, '');
}

export function resolveOptions(o: CmsOptions = {}): ResolvedCmsOptions {
  return {
    adminBasePath: normalizePath(o.adminBasePath ?? '/admin'),
    newsBasePath: normalizePath(o.newsBasePath ?? '/news'),
    mediaBasePath: normalizePath(o.mediaBasePath ?? '/cms-media'),
    brand: o.brand ?? 'astro-cloudflare-cms',
    defaultEyecatchUrl: o.defaultEyecatchUrl ?? '',
  };
}
```

- [ ] **Step 9: Run the test to verify it PASSES**

Run: `npm run test -w astro-cloudflare-cms`
Expected: PASS (3 tests).

- [ ] **Step 10: Implement the injected health route** — `packages/astro-cloudflare-cms/src/routes/_health.ts`

```ts
import type { APIRoute } from 'astro';

export const GET: APIRoute = () =>
  Response.json({ ok: true, name: 'astro-cloudflare-cms' });
```

- [ ] **Step 11: Implement the integration** — `packages/astro-cloudflare-cms/src/integration.ts`

```ts
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
```

- [ ] **Step 12: Commit**

```bash
git add package.json README.md packages/astro-cloudflare-cms
git commit -m "feat(pkg): integration skeleton with options + injected health route"
```

---

### Task 2: examples/demo host

**Files:**
- Create: `examples/demo/package.json`
- Create: `examples/demo/astro.config.mjs`
- Create: `examples/demo/wrangler.jsonc`
- Create: `examples/demo/tsconfig.json`
- Create: `examples/demo/src/pages/index.astro`

**Interfaces:**
- Consumes: `cms` (default export of `astro-cloudflare-cms`) from Task 1.
- Produces: a buildable Astro + Cloudflare host with `cms()` in its integrations; the package resolves via the workspace link.

- [ ] **Step 1: Demo manifest** — `examples/demo/package.json`

```json
{
  "name": "examples-demo",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "npm run build && npx wrangler dev"
  },
  "dependencies": {
    "@astrojs/cloudflare": "^12.0.0",
    "@astrojs/react": "^4.0.0",
    "astro": "^5.0.0",
    "astro-cloudflare-cms": "*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```
> `"astro-cloudflare-cms": "*"` resolves to the local workspace package (npm links it).

- [ ] **Step 2: Demo Astro config** — `examples/demo/astro.config.mjs`

```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import cms from 'astro-cloudflare-cms';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({ platformProxy: { enabled: true } }),
  integrations: [react(), cms()],
});
```

- [ ] **Step 3: Demo wrangler config** — `examples/demo/wrangler.jsonc`

```jsonc
{
  "name": "astro-cloudflare-cms-demo",
  "compatibility_date": "2025-09-01",
  "compatibility_flags": ["nodejs_compat"],
  "main": "dist/_worker.js/index.js",
  "assets": { "directory": "dist", "binding": "ASSETS" },
  "d1_databases": [
    { "binding": "DB", "database_name": "acc_demo_db", "database_id": "local-placeholder", "migrations_dir": "migrations" }
  ],
  "r2_buckets": [
    { "binding": "MEDIA", "bucket_name": "acc-demo-media" }
  ],
  "vars": { "PUBLIC_R2_BASE_URL": "", "DEFAULT_EYECATCH_URL": "" }
}
```
> `database_id` is a local placeholder; the CLI (Stage 5) replaces it with the real id. D1/R2 are unused until later stages but declared now.

- [ ] **Step 4: Demo tsconfig** — `examples/demo/tsconfig.json`

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "src"],
  "exclude": ["dist"]
}
```

- [ ] **Step 5: Demo home page** — `examples/demo/src/pages/index.astro`

```astro
---
---
<html lang="ja">
  <head><meta charset="utf-8" /><title>astro-cloudflare-cms demo</title></head>
  <body>
    <main>
      <h1>astro-cloudflare-cms demo host</h1>
      <p>The CMS routes are injected by the integration. Health check:
        <a href="/admin/_health">/admin/_health</a></p>
    </main>
  </body>
</html>
```

- [ ] **Step 6: Commit**

```bash
git add examples/demo
git commit -m "feat(demo): minimal Astro + Cloudflare host installing the integration"
```

---

### Task 3: End-to-end verification (build + injected route serves)

**Files:** none (verification task).

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: evidence that the integration loads in the host, the route is injected, and it serves at `${adminBasePath}/_health`.

- [ ] **Step 1: Install and build the demo**

Run:
```bash
npm install
npm run build -w examples/demo
```
Expected: build completes without errors; the Astro build logs include the integration's `astro-cloudflare-cms: routes injected under /admin` info line and produce `examples/demo/dist/`.

- [ ] **Step 2: Run the package unit tests**

Run:
```bash
npm run test -w astro-cloudflare-cms
```
Expected: PASS (3 options tests).

- [ ] **Step 3: Verify the injected route serves under wrangler**

Run (from `examples/demo`):
```bash
cd examples/demo
npm run build
npx wrangler dev --port 8810 &
# wait until listening, then:
curl -s http://localhost:8810/admin/_health
```
Expected: `{"ok":true,"name":"astro-cloudflare-cms"}`. Then stop the background `wrangler dev` process.
> This proves end-to-end: integration → injectRoute → route served by the host worker. If `wrangler dev` cannot be driven in the environment, the successful `astro build` (Step 1, which runs the integration's `astro:config:setup` and resolves the injected entrypoint) is the floor; note which live checks were skipped.

- [ ] **Step 4: Commit a short verification note (optional) and finish**

```bash
git add -A
git commit -m "chore: verify Stage 1 (integration injects a served route in the demo)" --allow-empty
```

---

## Self-Review

**1. Spec coverage (Stage 1 portion of spec §9):** monorepo skeleton (Task 1 root + workspaces) ✓; empty/minimal `cms()` integration (Task 1) ✓; `examples/demo` boots (Tasks 2–3) ✓; option-driven path prefix proven via `${adminBasePath}/_health` (Tasks 1,3) ✓. Deferred to later stages (intentional): real routes/lib (Stage 2–3), UI + bundled CSS (Stage 4), CLI (Stage 5), E2E (Stage 6).

**2. Placeholder scan:** No TBD/“handle errors”/“similar to”. The `database_id: "local-placeholder"` is explained (CLI replaces it; unused in Stage 1). `_health` is a deliberate Stage-1 probe, replaced by real routes in Stage 3.

**3. Type consistency:** `CmsOptions`/`ResolvedCmsOptions`/`resolveOptions` defined in Task 1 and consumed by `integration.ts` (Task 1) and the demo `cms()` (Task 2). Integration `name` `astro-cloudflare-cms` consistent. Path-normalization rule (leading slash, no trailing) matches the test and the spec's Global Constraints.
