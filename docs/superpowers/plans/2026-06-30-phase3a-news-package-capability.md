# Phase 3a — News package capability (themed, scaffold-light) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Give the package everything needed to add a native-looking `/news` to a web-studio (Astro 7 + Tailwind v4 + `@theme`) host with minimal host files: a public data API, package-owned themed News components, and an `init` step that scaffolds two thin pages + wires Tailwind `@source`. Verified in-repo on a minimal Tailwind-v4 host. (Real test-site install is Phase 3b.)

**Architecture:** News UI components live in the package and use `@theme` token utilities. The host's Tailwind v4 build themes them via an explicit `@source` directive `init` adds to the host `global.css`. Only two thin pages (`/news/index`, `/news/[slug]`) are scaffolded into the host so they can wrap the host `Layout` and run on-demand (`prerender = false`). The integration no longer injects `/news`. SSR data comes from a new `astro-cloudflare-cms/data` export.

**Tech Stack:** Astro 7.0.3, `@astrojs/cloudflare` 14, `@astrojs/react` 6, React 19, Tailwind v4 (host), `cloudflare:workers` env (Phase 1 baseline).

## Global Constraints

- **Binding access:** `import { env } from 'cloudflare:workers'` (NOT `locals.runtime.env`). 
- **Relative imports only** in runtime files; `@/` is tests-only. Package public imports use the package name (`astro-cloudflare-cms/data`) from scaffolded host files.
- **Paths from `virtual:acc-config`** for admin/news prefixes; `/cms-media` fixed.
- **Hybrid:** scaffolded `/news` pages MUST `export const prerender = false`.
- **Token contract (web-studio standard, what package components may rely on):** colors `bg, ink, muted, brand, surface, line`; fonts `display, body`. Use only these (`bg-bg`, `text-ink`, `text-muted`, `text-brand`, `bg-surface`, `border-line`, `font-display`, `font-body`) so any web-studio host themes them.
- **Cooldown:** prefix npm commands that hit `ETARGET ... min-release-age` with `npm_config_min_release_age=0` (never edit `~/.npmrc`).
- **Git:** plain commit; trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Zero-config default:** host `Layout` = `src/layouts/Layout.astro`; overridable via `cms({ news: { layout } })`.

## Files

- Create: `packages/astro-cloudflare-cms/src/data.ts` (public data barrel)
- Modify: `packages/astro-cloudflare-cms/package.json` (`exports` += `./data`)
- Modify: `packages/astro-cloudflare-cms/src/integration.ts` (remove the 2 `/news` injectRoute lines)
- Delete: `packages/astro-cloudflare-cms/src/routes/news/index.astro`, `src/routes/news/[slug].astro`
- Create: `packages/astro-cloudflare-cms/src/news/NewsList.astro`, `NewsCard.astro`, `Article.astro`, `news-content.css`
- Create: `packages/astro-cloudflare-cms/src/scaffold/news/index.astro`, `src/scaffold/news/[slug].astro` (thin host-page templates)
- Modify: `packages/astro-cloudflare-cms/src/options.ts` (add `news.layout` option + default)
- Modify: `packages/astro-cloudflare-cms/src/cli/init.mjs` (+ new `src/cli/scaffold.mjs`) — scaffold thin pages + add `@source` to host global.css
- Create: `packages/astro-cloudflare-cms/test/cli-scaffold.test.ts` (pure scaffold-helper tests)
- Modify (Task 6): `examples/demo/*` to a minimal Tailwind-v4 web-studio host for verification

---

### Task 1: Spike — confirm Tailwind v4 `@source` themes a packaged component

**Files:** scratch only (no repo changes). Working dir: the session scratchpad.

**Interfaces:** Produces a go/no-go for the whole "components-in-package" approach. If NO-GO, stop and escalate (fall back to scaffolding components into host src).

- [ ] **Step 1: Build a minimal Tailwind v4 repro**

In a scratch dir create `comp.astro` with `<div class="bg-bg text-ink font-display border-line">x</div>` and `in.css`:
```css
@import "tailwindcss";
@theme { --color-bg:#abcdef; --color-ink:#112233; --color-line:#cccccc; --font-display: Georgia, serif; }
@source "./comp.astro";
```

- [ ] **Step 2: Run the Tailwind v4 CLI**

Run: `npm_config_min_release_age=0 npx @tailwindcss/cli@latest -i in.css -o out.css`
Expected: completes, writes `out.css`.

- [ ] **Step 3: Assert the token utilities were generated from the @source file**

Run: `grep -E "\.bg-bg|\.text-ink|\.font-display|\.border-line" out.css`
Expected: rules for `.bg-bg` (using `#abcdef`/`--color-bg`), `.text-ink`, `.font-display`, `.border-line` are present — proving `@source` made Tailwind scan the external component and emit host-token-themed utilities.

- [ ] **Step 4: Record the result**

If present → GO; report DONE with the matched rules. If absent → NO-GO; report BLOCKED with the output so the controller switches to the fallback (scaffold components into host src). No commit (spike is scratch-only).

---

### Task 2: Public data API export (`astro-cloudflare-cms/data`)

**Files:** Create `src/data.ts`; Modify `package.json`.

**Interfaces:**
- Produces: `astro-cloudflare-cms/data` re-exporting `listPublicArticles`, `getPublicArticleBySlug` (from `./lib/db-articles`), `eyecatchOf` (from `./lib/eyecatch`), `renderBody` (from `./lib/render-body`), and the `PublicArticleListItem` / `ArticleRow` types. Scaffolded host pages import from here.

- [ ] **Step 1: Write a failing test**

Create `test/data-export.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import * as data from '@/data';
describe('data barrel', () => {
  it('re-exports the public read helpers', () => {
    expect(typeof data.listPublicArticles).toBe('function');
    expect(typeof data.getPublicArticleBySlug).toBe('function');
    expect(typeof data.eyecatchOf).toBe('function');
    expect(typeof data.renderBody).toBe('function');
  });
});
```

- [ ] **Step 2: Run it, watch it fail**

Run: `cd packages/astro-cloudflare-cms && npx vitest run test/data-export.test.ts`
Expected: FAIL (`Cannot find module '@/data'`).

- [ ] **Step 3: Create `src/data.ts`**

```ts
// Public, host-facing data API for scaffolded /news pages (SSR).
export { listPublicArticles, getPublicArticleBySlug } from './lib/db-articles';
export type { PublicArticleListItem, ArticleRow } from './lib/db-articles';
export { eyecatchOf } from './lib/eyecatch';
export { renderBody } from './lib/render-body';
```
(Verify the exact exported symbol names in `src/lib/db-articles.ts`, `eyecatch.ts`, `render-body.ts` and match them; adjust this barrel to whatever those modules actually export.)

- [ ] **Step 4: Add the package export**

In `package.json` `exports`, add `"./data": "./src/data.ts"`.

- [ ] **Step 5: Run the test + typecheck**

Run: `npx vitest run test/data-export.test.ts && npx tsc --noEmit -p tsconfig.json`
Expected: PASS; tsc exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages/astro-cloudflare-cms/src/data.ts packages/astro-cloudflare-cms/package.json packages/astro-cloudflare-cms/test/data-export.test.ts
git commit -m "feat(data): public astro-cloudflare-cms/data export for host /news pages

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Stop injecting `/news`; remove the old package news routes

**Files:** Modify `src/integration.ts`; Delete `src/routes/news/index.astro`, `src/routes/news/[slug].astro`.

**Interfaces:**
- Consumes: nothing.
- Produces: the integration no longer registers `/news` routes (host scaffold owns them). Admin, API, and `/cms-media` injection unchanged.

- [ ] **Step 1: Remove the two news injectRoute lines**

In `src/integration.ts`, delete the two lines injecting `o.newsBasePath` (index) and `${o.newsBasePath}/[slug]`. Leave all admin/api/cms-media injectRoute calls intact.

- [ ] **Step 2: Delete the now-unused package news routes**

```bash
git rm packages/astro-cloudflare-cms/src/routes/news/index.astro packages/astro-cloudflare-cms/src/routes/news/[slug].astro
```

- [ ] **Step 3: Typecheck + tests**

Run: `cd packages/astro-cloudflare-cms && npx tsc --noEmit -p tsconfig.json && npm test`
Expected: tsc 0; tests pass (note: if any test referenced the removed news routes, update it — there should be none; the news rendering was only exercised via the demo).

- [ ] **Step 4: Commit**

```bash
git add packages/astro-cloudflare-cms/src/integration.ts
git commit -m "refactor(integration): stop injecting /news (host owns it via scaffold)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Package-owned, themed News components

**Files:** Create `src/news/NewsList.astro`, `NewsCard.astro`, `Article.astro`, `news-content.css`.

**Interfaces:**
- Consumes: types from `./lib/db-articles` and `eyecatchOf`/`renderBody` (import relatively within the package).
- Produces (host-facing component contracts the scaffolded pages rely on):
  - `NewsList` props: `{ articles: PublicArticleListItem[]; baseUrl: string; newsBasePath: string; r2BaseUrl?: string; defaultEyecatchUrl?: string }` — renders a responsive grid of `NewsCard`.
  - `NewsCard` props: `{ article: PublicArticleListItem; href: string; imageUrl: string }`.
  - `Article` props: `{ title: string; publishAt: number; html: string; heroUrl: string; backHref: string }` — renders the article detail (back link, hero, title, date, body via the html string already sanitized by `renderBody`). Imports `./news-content.css` for body typography.

- [ ] **Step 1: Write the three components using ONLY the token contract**

Use only `bg-bg / text-ink / text-muted / text-brand / bg-surface / border-line / font-display / font-body` plus layout/spacing utilities (`grid`, `gap-*`, `aspect-[…]`, `rounded-*`, `max-w-*`, `px/py-*`). No hard-coded colors/fonts. `NewsCard` image uses `aspect-[16/9] object-cover` so layout is stable. `Article` wraps the body in `<div class="news-content" set:html={html} />`.

Example shape for `NewsCard.astro` (fill the rest following web-studio discipline):
```astro
---
import type { PublicArticleListItem } from '../lib/db-articles';
interface Props { article: PublicArticleListItem; href: string; imageUrl: string; }
const { article, href, imageUrl } = Astro.props;
const fmt = (e: number) => new Date(e * 1000).toLocaleDateString('ja-JP');
---
<a href={href} class="group block overflow-hidden rounded-lg border border-line bg-surface">
  <img src={imageUrl} alt="" class="aspect-[16/9] w-full object-cover" />
  <div class="p-4">
    <time class="text-xs text-muted">{fmt(article.publish_at)}</time>
    <h2 class="mt-1 font-display text-lg text-ink">{article.title}</h2>
    {article.excerpt && <p class="mt-1 text-sm text-muted">{article.excerpt}</p>}
  </div>
</a>
```

- [ ] **Step 2: Write `news-content.css` (token-aware body typography, no typography plugin)**

Scope every rule under `.news-content` and style `h2,h3` with `font-display`, paragraphs/lists/blockquote/links/img with token vars (`var(--color-ink)`, `var(--color-brand)`, `var(--color-line)`). Headings/list/quote spacing for readable article bodies.

- [ ] **Step 3: Typecheck**

Run: `cd packages/astro-cloudflare-cms && npx tsc --noEmit -p tsconfig.json`
Expected: exit 0 (component prop types resolve).

- [ ] **Step 4: Commit**

```bash
git add packages/astro-cloudflare-cms/src/news
git commit -m "feat(news): package-owned themed News components (@theme tokens)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `init` scaffolding — thin pages + `@source` wiring + zero-config Layout

**Files:** Create `src/scaffold/news/index.astro`, `src/scaffold/news/[slug].astro`; Modify `src/options.ts`; Create `src/cli/scaffold.mjs`; Modify `src/cli/init.mjs`; Create `test/cli-scaffold.test.ts`.

**Interfaces:**
- Consumes: data export (Task 2), package news components (Task 4), `news.layout` option.
- Produces: `init` writes `<host>/src/pages/news/index.astro` + `[slug].astro` (from the templates, with the Layout import path substituted) and appends an `@source` line to the host `global.css`. Pure helpers exported for tests: `resolveLayoutImport(pageDir, layoutPath)`, `sourceDirectiveFor(globalCssPath)`, `renderScaffoldPage(template, layoutImport)`.

- [ ] **Step 1: Write the two thin page templates**

`src/scaffold/news/index.astro` (the `__LAYOUT_IMPORT__` token is rewritten by init):
```astro
---
export const prerender = false;
import Layout from '__LAYOUT_IMPORT__';
import { NewsList } from 'astro-cloudflare-cms/news';
import { listPublicArticles } from 'astro-cloudflare-cms/data';
import { env } from 'cloudflare:workers';
const now = Math.floor(Date.now() / 1000);
const articles = await listPublicArticles(env.DB, now);
---
<Layout title="News">
  <main class="mx-auto max-w-5xl px-6 py-16">
    <h1 class="font-display text-3xl text-ink">News</h1>
    <NewsList articles={articles} baseUrl={import.meta.env.PUBLIC_R2_BASE_URL ?? ''} newsBasePath="/news" />
  </main>
</Layout>
```
`src/scaffold/news/[slug].astro`: same header pattern, calls `getPublicArticleBySlug`, 404s when missing, renders `<Article .../>`. (Use `renderBody` for the body html, `eyecatchOf` for the hero.)
> Note: `astro-cloudflare-cms/news` must export the components — add `src/news/index.ts` re-exporting `NewsList`/`NewsCard`/`Article` and a `package.json` `exports` entry `"./news": "./src/news/index.ts"` as part of this task (the components are `.astro`; export them through an `index.ts` barrel that `export { default as NewsList } from './NewsList.astro'`).

- [ ] **Step 2: Add the `news.layout` option (zero-config default)**

In `src/options.ts`, extend the options type + normalization with `news?: { layout?: string }`, defaulting `layout` to `'src/layouts/Layout.astro'`. Expose it on the resolved config (and via `virtual:acc-config` if the runtime needs it — the scaffolded pages don't, they hard-import; so config-only is fine).

- [ ] **Step 3: Write scaffold pure-helper tests (TDD)**

Create `test/cli-scaffold.test.ts` covering:
```ts
import { describe, it, expect } from 'vitest';
import { renderScaffoldPage, sourceDirectiveFor } from '@/cli/scaffold.mjs';
describe('scaffold helpers', () => {
  it('substitutes the layout import token', () => {
    const out = renderScaffoldPage("import Layout from '__LAYOUT_IMPORT__';", '../../layouts/Layout.astro');
    expect(out).toContain("import Layout from '../../layouts/Layout.astro'");
    expect(out).not.toContain('__LAYOUT_IMPORT__');
  });
  it('builds an @source line pointing at the package news components', () => {
    const line = sourceDirectiveFor();
    expect(line).toContain('@source');
    expect(line).toContain('astro-cloudflare-cms');
    expect(line).toContain('news');
  });
});
```

- [ ] **Step 4: Run tests, watch them fail**

Run: `cd packages/astro-cloudflare-cms && npx vitest run test/cli-scaffold.test.ts`
Expected: FAIL (`Cannot find module '@/cli/scaffold.mjs'`).

- [ ] **Step 5: Implement `src/cli/scaffold.mjs`**

Export the pure helpers + a `scaffoldNews({ cwd, layout })` that: computes the page dir (`<cwd>/src/pages/news`), reads the two templates from the package (`new URL('../scaffold/news/...', import.meta.url)`), rewrites `__LAYOUT_IMPORT__` to the relative path from the page dir to the host layout, writes them (skip if exist unless `--force`), creates `<cwd>/src/components/news`? (NO — components stay in package), and appends the `@source` line to the host `global.css` (default `<cwd>/src/styles/global.css`) if not already present. `renderScaffoldPage(template, layoutImport)` = `template.replaceAll('__LAYOUT_IMPORT__', layoutImport)`. `sourceDirectiveFor()` returns `@source "../../node_modules/astro-cloudflare-cms/src/news";` (path relative to the host global.css; confirm against the spike's working path).

- [ ] **Step 6: Wire into `init`**

In `src/cli/init.mjs`, after the master-user step, call `scaffoldNews({ cwd, layout })` (layout from flags/config default) and log what it wrote. Add a `--no-scaffold` escape and `--force` passthrough.

- [ ] **Step 7: Run tests + typecheck**

Run: `npx vitest run test/cli-scaffold.test.ts && npm test && npx tsc --noEmit -p tsconfig.json`
Expected: scaffold tests PASS; full suite green; tsc 0.

- [ ] **Step 8: Commit**

```bash
git add packages/astro-cloudflare-cms/src/scaffold packages/astro-cloudflare-cms/src/news/index.ts packages/astro-cloudflare-cms/src/options.ts packages/astro-cloudflare-cms/src/cli/scaffold.mjs packages/astro-cloudflare-cms/src/cli/init.mjs packages/astro-cloudflare-cms/package.json packages/astro-cloudflare-cms/test/cli-scaffold.test.ts
git commit -m "feat(cli): scaffold thin /news pages + Tailwind @source; zero-config Layout

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: In-repo verification on a minimal Tailwind-v4 web-studio demo

**Files:** Modify `examples/demo/` — add `src/styles/global.css` (`@import "tailwindcss"; @theme {…standard tokens…}`), `src/layouts/Layout.astro` (title prop + `<slot/>`), wire `@tailwindcss/vite` in `astro.config.mjs`; keep the CMS integration.

**Interfaces:**
- Consumes: Tasks 2–5.
- Produces: proof that `init` scaffolding + `@source` theming produce a native-looking `/news` on a Tailwind-v4 host, with admin still working.

- [ ] **Step 1: Make the demo a minimal web-studio-style host**

Add Tailwind v4 (`@tailwindcss/vite` in `astro.config.mjs` vite plugins; `npm_config_min_release_age=0 npm i -D @tailwindcss/vite -w examples/demo` if not present), `src/styles/global.css` with `@import "tailwindcss"` + a standard `@theme` token block (bg/ink/muted/brand/surface/line + font-display/body), and `src/layouts/Layout.astro` that imports global.css and renders `<title>` + `<slot/>`.

- [ ] **Step 2: Run the scaffold**

Run: `cd examples/demo && node ../../packages/astro-cloudflare-cms/bin/cli.mjs init --local --yes --master-email a@b.c --master-password testpass12` (or call the scaffold path directly if init's full flow is heavier than needed). Confirm it wrote `src/pages/news/index.astro` + `[slug].astro` and appended the `@source` line to `src/styles/global.css`.

- [ ] **Step 3: Build + assert themed output**

```bash
cd /Users/tomotakayajima/Desktop/yjm/git/astro-cloudflare-cms
rm -rf examples/demo/{dist,.astro,node_modules/.vite}
npm run build -w examples/demo
```
Assert the host CSS now contains the token utilities used by the package news components (grep the built CSS in `dist/` for `.text-brand` / `.border-line` / `.font-display`), proving `@source` themed the package components with the demo's tokens.

- [ ] **Step 4: Runtime check**

`npx astro dev` (Phase 1 finding: v14 serves D1/R2 locally) in `examples/demo`; verify `GET /news` → 200 and renders cards using the demo Layout/tokens; create an article via `/admin` (or the CLI `create-user`/article API) and confirm it appears on `/news`. Stop dev when done.

- [ ] **Step 5: Gate + record findings**

`npx tsc --noEmit -p tsconfig.json` (0) and `npm test` (green). Append a `## Phase 3a findings` section to the spec (the working `@source` path, the exact token utilities confirmed, the scaffold output layout, anything 3b must know). Commit the demo changes + spec.

```bash
git add examples/demo docs/superpowers/specs/2026-06-29-web-studio-cms-retarget-design.md
git commit -m "test(demo): verify themed /news via @source on a Tailwind-v4 host; record 3a findings

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

- **Spec coverage:** implements the Phase 3 refinement C+D and the data/stop-injecting pieces: data export (T2), stop injecting /news (T3), package themed components (T4), init scaffold + @source + zero-config (T5), in-repo themed verification (T6). The `@source` linchpin is de-risked first (T1). Unified `init` config-wiring (A) for an unconfigured host and the real test-site install are **Phase 3b** (not here). `astro dev` dev path (B) is used in T6 and will be documented in the docs pass.
- **Placeholder scan:** concrete files/commands throughout; exact code for data barrel, scaffold templates, helpers, and tests. UI component markup is specified by prop contract + token-class rules + an example (the markup is a creative artifact produced to that spec) — not a vague "implement component".
- **Type/interface consistency:** `NewsList`/`Article` prop contracts in T4 match what the scaffold templates in T5 pass; `astro-cloudflare-cms/data` and `astro-cloudflare-cms/news` export names are fixed in T2/T5.

## Risks

- **T1 NO-GO:** if `@source` does not theme package components, fall back to scaffolding the components into host src (the pre-refinement design) — T4/T5 change to copy components instead of `@source`. T1 gates this before any dependent work.
- **Monorepo symlink:** the demo resolves the package via workspace symlink; confirm the `@source` path resolves through it in T6 (a real host installs to `node_modules/astro-cloudflare-cms` directly, which is simpler).
