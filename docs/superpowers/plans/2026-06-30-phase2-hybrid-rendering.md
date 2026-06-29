# Phase 2 — Hybrid rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a host site static-first while the CMS's own routes are server-rendered: marketing pages prerender to static HTML, and `/admin`, the admin API, `/cms-media`, and `/news` run on-demand on Cloudflare.

**Architecture:** Astro's hybrid model. The host keeps `output: 'static'` (the default) plus the Cloudflare adapter. Every route the integration injects opts into on-demand rendering with `export const prerender = false`. The host's own pages need no changes — they stay static automatically.

**Tech Stack:** Astro 7.0.3, `@astrojs/cloudflare` 14.0.1, `@astrojs/react` 6.0.0, React 19. (Baseline from Phase 1, already on `main`.)

## Global Constraints

- **Binding access (Phase 1 baseline):** runtime files use `import { env } from 'cloudflare:workers'` — NOT `locals.runtime.env` (removed in Astro v6). Do not reintroduce the old pattern.
- **Relative imports only** in `src/routes/`, `src/components/`, `src/middleware.ts`, `src/lib/`. No `@/` alias (tests only).
- **Paths come from `virtual:acc-config`** (`config.adminBasePath` / `newsBasePath` / `brand`). Never hard-code `/admin` or `/news`. `/cms-media` is the one fixed internal path.
- **Admin shell stays `client:only="react"`** — do not change to `client:load`.
- **CSS bundled** — no class changes expected this phase; if any, rebuild `styles.css` via `npm run build:css -w astro-cloudflare-cms`.
- **Do not touch** password hashing (`src/lib/auth.ts`) or the D1 migration.
- **Cooldown:** any npm command hitting `ETARGET ... min-release-age` must be prefixed `npm_config_min_release_age=0` (never edit `~/.npmrc`).
- **Git:** plain `git commit` (identity already `yjmtmtk`); end commit bodies with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Adapter v14 output (Phase 1 finding):** build emits `dist/client/` (static assets/prerendered pages) + `dist/server/{entry.mjs, wrangler.json}` (the worker). Source `wrangler.jsonc` must NOT set `main`. Local dev that needs the seeded D1: `npx wrangler dev --config dist/server/wrangler.json --persist-to .wrangler/state` from `examples/demo` (or `npx astro dev`, which on v14 serves D1/R2 via the vite plugin).

## Files

- Modify (add `export const prerender = false;`): the 18 injected route files —
  - `.astro` (8): `src/routes/admin/index.astro`, `admin/login.astro`, `admin/categories.astro`, `admin/users.astro`, `admin/articles/new.astro`, `admin/articles/[id].astro`, `src/routes/news/index.astro`, `news/[slug].astro`
  - `.ts` (10): `src/routes/admin/api/login.ts`, `admin/api/logout.ts`, `admin/api/upload.ts`, `admin/api/articles/index.ts`, `admin/api/articles/[id].ts`, `admin/api/categories/index.ts`, `admin/api/categories/[id].ts`, `admin/api/users/index.ts`, `admin/api/users/[id].ts`, `src/routes/cms-media/[...key].ts`
- Modify: `examples/demo/astro.config.mjs` (static-first + drop stale `platformProxy`)
- Modify (Task 3): `docs/superpowers/specs/2026-06-29-web-studio-cms-retarget-design.md` (append Phase 2 findings)

---

### Task 1: Mark all injected CMS routes as on-demand (`prerender = false`)

**Files:** the 18 route files listed above.

**Interfaces:**
- Consumes: nothing new.
- Produces: every injected route exports `prerender = false`, so they are SSR under a static-output host. No behavior change to handlers.

- [ ] **Step 1: Add the export to each `.ts` API route**

For each of the 10 `.ts` files, add as the first line (above the existing imports):

```ts
export const prerender = false;
```

- [ ] **Step 2: Add the export to each `.astro` route**

For each of the 8 `.astro` files, add `export const prerender = false;` inside the frontmatter fence, as the first line after the opening `---` (before the existing imports). Example for `src/routes/news/[slug].astro`:

```astro
---
export const prerender = false;
import '../../../styles.css';
import { env } from 'cloudflare:workers';
// ...rest unchanged
---
```

- [ ] **Step 3: Typecheck**

Run: `cd packages/astro-cloudflare-cms && npx tsc --noEmit -p tsconfig.json`
Expected: exit 0 (a top-level `export const prerender = false` is valid in both `.ts` and `.astro` modules).

- [ ] **Step 4: Unit tests (no behavior change)**

Run: `npm test`
Expected: 106 passed (these exports do not affect lib/cli unit tests).

- [ ] **Step 5: Commit**

```bash
git add packages/astro-cloudflare-cms/src/routes
git commit -m "feat(render): mark injected CMS routes prerender=false (hybrid)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Switch the demo host to static-first hybrid and verify the split

**Files:** `examples/demo/astro.config.mjs`

**Interfaces:**
- Consumes: Task 1 (routes now opt into on-demand).
- Produces: a demo that prerenders its marketing page to static HTML while serving CMS routes on-demand.

- [ ] **Step 1: Make the demo static-first**

Replace the contents of `examples/demo/astro.config.mjs` with:

```js
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
```
(Drops `output: 'server'` → `'static'`, and removes the stale v13 `platformProxy` option.)

- [ ] **Step 2: Clean build**

```bash
cd /Users/tomotakayajima/Desktop/yjm/git/astro-cloudflare-cms
rm -rf examples/demo/{dist,.astro,node_modules/.vite}
npm run build -w examples/demo
```
Expected: `[build] Complete!`

- [ ] **Step 3: Assert the hybrid split in `dist/`**

Run:
```bash
ls examples/demo/dist/client/index.html        # marketing page prerendered (static)
ls examples/demo/dist/server/entry.mjs examples/demo/dist/server/wrangler.json  # worker for on-demand routes
test ! -e examples/demo/dist/client/admin && echo "admin NOT prerendered (on-demand) ✓"
```
Expected: `dist/client/index.html` exists; the server entry + wrangler.json exist; there is no prerendered `dist/client/admin` directory (admin is on-demand).

- [ ] **Step 4: Runtime smoke (marketing static + CMS SSR + D1)**

Start dev (background) and verify both a static and a dynamic route, plus auth+D1:
```bash
cd examples/demo && npx wrangler dev --config dist/server/wrangler.json --persist-to .wrangler/state
```
Then (Origin header satisfies Astro 7's CSRF check):
```bash
curl -s -o /dev/null -w "home=%{http_code}\n" http://localhost:8787/
curl -s -o /dev/null -w "admin_login=%{http_code}\n" http://localhost:8787/admin/login
curl -s -o /dev/null -w "news=%{http_code}\n" http://localhost:8787/news
curl -s -i -c /tmp/acc-cookies.txt -X POST http://localhost:8787/admin/api/login \
  -H 'content-type: application/x-www-form-urlencoded' -H 'Origin: http://localhost:8787' \
  -d 'email=admin@example.com&password=admin1234' | grep -i 'HTTP/\|set-cookie'
curl -s -b /tmp/acc-cookies.txt -o /dev/null -w "articles_api=%{http_code}\n" http://localhost:8787/admin/api/articles
```
Expected: `home=200`, `admin_login=200`, `news=200`, login `303` + `nanocms_session` cookie, `articles_api=200`. Stop the background dev process and remove `/tmp/acc-cookies.txt` when done.

- [ ] **Step 5: Commit**

```bash
git add examples/demo/astro.config.mjs
git commit -m "feat(demo): static-first hybrid (output:static + adapter; drop stale platformProxy)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Full gate + record Phase 2 findings

**Files:** `docs/superpowers/specs/2026-06-29-web-studio-cms-retarget-design.md`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: the Phase 2 done-definition met and findings recorded for Phases 3 & 5.

- [ ] **Step 1: Gates**

Run: `cd packages/astro-cloudflare-cms && npx tsc --noEmit -p tsconfig.json && npm test`
Expected: tsc exit 0; 106 passed.

- [ ] **Step 2: Append a `## Phase 2 findings` section to the spec**

Record: the static-first + per-route `prerender = false` mechanism (host pages stay static with zero host changes); the `dist/client` (static) vs `dist/server` (on-demand) split confirmed; the demo config shape; and the implication for Phase 3 (scaffolded `/news` pages must also `export const prerender = false`) and Phase 5 (init should set the host to `output:'static'` + adapter, not `'server'`, and the README "Astro 5 / output:'server'" requirement is now wrong).

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-06-29-web-studio-cms-retarget-design.md
git commit -m "docs(spec): record Phase 2 hybrid-rendering findings

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

- **Spec coverage:** Implements spec Phase 2 ("Host stays `output: 'static'` + adapter; CMS injected routes set `prerender = false`; marketing pages stay static"). Task 1 = route opt-out; Task 2 = host config + the static/on-demand split verification; Task 3 = gate + findings. The stale `platformProxy` cleanup (a Phase 1/5 finding) is folded into Task 2 since it lives in the same file being edited.
- **Placeholder scan:** none — exact file list, exact export line, exact config, exact commands/expected output.
- **Type/behavior consistency:** `export const prerender = false` is the only addition to handlers; no signatures or behavior change. Binding access stays on the Phase 1 `cloudflare:workers` pattern.

## Note on scope

Integration-level guards (e.g. the integration warning when a host sets `output:'server'` or lacks an adapter) and the README requirement update are deferred to Phase 5 (init DX) / the docs pass, to keep this phase to the rendering-model change and its demo verification.
