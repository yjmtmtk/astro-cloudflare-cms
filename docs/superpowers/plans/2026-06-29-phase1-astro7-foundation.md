# Phase 1 — Astro 7 / adapter foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get the package and its demo building and testing green on the current Astro stack (Astro 7 / `@astrojs/cloudflare` 14 / `@astrojs/react` 6 / React 19), so later phases can build on a known-good baseline.

**Architecture:** This is a **migration spike**, not a feature. Bump the dependency floors, then build/typecheck/run and triage whatever the Astro 6→7 jump breaks (integration API, adapter, `output`, types). Each task ends at a concrete gate (`tsc`, `vitest`, `astro build`, `wrangler dev`). Exact code fixes are *discovered at build time* — this plan specifies the process, the gates, and the known-likely breakage areas, and Task 7 captures the actual fixes found so Phases 2–5 can be planned from a real baseline.

**Tech Stack:** Astro 7, `@astrojs/cloudflare` ^14 (peer astro ^7), `@astrojs/react` ^6, React 19, Tailwind v3 (bundled admin CSS — unchanged this phase), Vitest + `@cloudflare/vitest-pool-workers`, D1/R2, Wrangler.

## Global Constraints

Copied verbatim from the spec and the project's non-negotiable design rules. Every task implicitly includes these:

- **Relative imports only** in runtime files (`routes/`, `components/`, `middleware.ts`, `lib/`). No `@/` alias (it resolves to the host's `src`); `@/` is for tests only.
- **Paths come from `virtual:acc-config`** (`config.adminBasePath` / `newsBasePath` / `brand`); never hard-code `/admin` or `/news`. `/cms-media` is the one fixed internal path.
- **Admin shell is `client:only="react"`** (React #418 fix); do not revert to `client:load`. Public pages stay SSR.
- **CSS is pre-built and bundled** into `styles.css`; after changing component classes run `npm run build:css -w astro-cloudflare-cms` and commit. (No CSS class changes expected this phase.)
- **CLI password hashing stays byte-identical to `src/lib/auth.ts`**; `test/cli-crypto.test.ts` asserts parity. Do not touch hashing this phase.
- **Fixed bindings:** D1 = `DB`, R2 = `MEDIA`; env via `locals.runtime.env`.
- **Git identity** is already `yjmtmtk <tomotaka.yajima@gmail.com>`; commit normally. End commit bodies with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **This phase does NOT change** Tailwind to v4, the admin design, or `/news` theming — those are Phases 3–4. Keep the bundled `styles.css` pipeline as-is.

## Files (this phase)

- Modify: `packages/astro-cloudflare-cms/package.json` — `peerDependencies.astro` `^5`→`^7`; `devDependencies.astro` `^5`→`^7`.
- Modify: `examples/demo/package.json` — `astro` `^7`, `@astrojs/cloudflare` `^14`, `@astrojs/react` `^6`, `react`/`react-dom` `^19` (confirm).
- Modify (as triage requires): `packages/astro-cloudflare-cms/src/integration.ts`, `src/middleware.ts`, `src/routes/**`, `src/lib/types.ts` / `App.Locals` typing — only the spots Astro 7 breaks.
- Modify (if needed): root `package.json` (`@cloudflare/vitest-pool-workers` bump) and `patches/@cloudflare+vitest-pool-workers+*.patch` (regenerate or delete).
- Modify (at end): `docs/superpowers/specs/2026-06-29-web-studio-cms-retarget-design.md` — append a "Phase 1 findings" note; and the READMEs' version mentions if they changed.

---

### Task 1: Isolate the work and bump dependency floors

**Files:**
- Modify: `packages/astro-cloudflare-cms/package.json`
- Modify: `examples/demo/package.json`

**Interfaces:**
- Produces: an installed workspace on the Astro 7 stack. Nothing code-facing yet.

- [ ] **Step 1: Create an isolation branch (or worktree)**

```bash
cd /Users/tomotakayajima/Desktop/yjm/git/astro-cloudflare-cms
git checkout -b feat/astro7-foundation
```
(Or use the `superpowers:using-git-worktrees` skill for a separate worktree — recommended because the migration may temporarily break the build.)

- [ ] **Step 2: Bump the package's astro range**

In `packages/astro-cloudflare-cms/package.json`, change `peerDependencies.astro` from `"^5"` to `"^7"` and `devDependencies.astro` from `"^5.0.0"` to `"^7.0.0"`.

- [ ] **Step 3: Bump the demo's stack**

In `examples/demo/package.json`, set `"astro": "^7.0.0"`, `"@astrojs/cloudflare": "^14.0.0"`, `"@astrojs/react": "^6.0.0"`, and confirm `"react": "^19.0.0"`, `"react-dom": "^19.0.0"`.

- [ ] **Step 4: Install**

Run: `npm install`
Expected: install completes. If `@astrojs/cloudflare@14`'s peer `astro ^7.0.0-alpha.2` warns against the resolved astro, note it; it should be satisfied by astro 7.0.3.

- [ ] **Step 5: Commit**

```bash
git add packages/astro-cloudflare-cms/package.json examples/demo/package.json package-lock.json
git commit -m "chore(deps): bump to Astro 7 / cloudflare 14 / react-integration 6

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Keep the unit suite green on the new install

**Files:**
- Modify (if needed): root `package.json` (`@cloudflare/vitest-pool-workers`), `patches/@cloudflare+vitest-pool-workers+*.patch`

**Interfaces:**
- Consumes: installed workspace from Task 1.
- Produces: `npm test` green (106 tests). The unit tests cover `lib/**` and `cli/**` (no Astro runtime), so they should be unaffected by Astro 7 unless the pool itself breaks.

- [ ] **Step 1: Run the suite as-is**

Run: `cd packages/astro-cloudflare-cms && npm test`
Expected: 106 passed. If green, skip to Step 4.

- [ ] **Step 2: If the pool fails to start or teardown errors**

Check whether the patched file path still matches the installed version:
Run: `ls patches/ && node -e "console.log(require('./node_modules/@cloudflare/vitest-pool-workers/package.json').version)"` (from repo root)
If the version changed, the patch name no longer matches and `patch-package` warned on install.

- [ ] **Step 3: Regenerate or retire the teardown patch**

If the installed `@cloudflare/vitest-pool-workers` still has the `.sqlite-wal`/`.sqlite-shm` assertion bug (teardown crash), regenerate the patch:
```bash
# edit node_modules/@cloudflare/vitest-pool-workers/dist/pool/index.mjs to skip
# .sqlite-wal/.sqlite-shm in pushStackedStorage and popStackedStorage, then:
npx patch-package @cloudflare/vitest-pool-workers
git rm patches/@cloudflare+vitest-pool-workers+0.6.16.patch   # remove the stale one
```
If the upstream version already skips those files, just delete the stale patch:
```bash
git rm patches/@cloudflare+vitest-pool-workers+0.6.16.patch
```
Re-run `npm install` then `npm test`.

- [ ] **Step 4: Commit (only if Task 2 changed files)**

```bash
git add -A
git commit -m "test: keep vitest-pool-workers green on the Astro 7 stack

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Typecheck the package against Astro 7 types and fix breakages

**Files:**
- Modify (as triage requires): `src/integration.ts`, `src/middleware.ts`, `src/routes/**/*.ts`, `src/lib/types.ts`

**Interfaces:**
- Consumes: Task 1 install.
- Produces: `npx tsc --noEmit` clean on Astro 7. Establishes the integration/middleware/route type surface that Phase 2+ relies on.

- [ ] **Step 1: Run the typecheck to surface breakages**

Run: `cd packages/astro-cloudflare-cms && npx tsc --noEmit -p tsconfig.json`
Expected (likely): type errors from Astro 7 API changes. Capture the full list.

- [ ] **Step 2: Triage by known-likely Astro 6→7 areas**

Map each error to its cause. Known surfaces to check against the installed Astro's types/docs (use the Cloudflare/Astro docs MCP if unsure):
- `IntegrationHooks` signature changes (`astro:config:setup` → `injectRoute`, `addMiddleware`, `updateConfig`, `injectTypes`, `addRenderer`).
- `injectRoute` shape (`entrypoint` as string vs URL).
- `APIRoute` / `APIContext` and `locals` typing; `App.Locals` augmentation.
- `output` enum changes (`'hybrid'` was removed in Astro 5; in 7 confirm `'static' | 'server'`).
- Adapter typing from `@astrojs/cloudflare` 14.

- [ ] **Step 3: Apply the minimal fixes**

Edit only the broken spots, preserving the Global Constraints (relative imports, `virtual:acc-config`, `client:only`). Show each fix as a focused diff in the commit. Do not refactor unrelated code.

- [ ] **Step 4: Re-run typecheck to green**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/astro-cloudflare-cms/src
git commit -m "fix(types): adapt integration/routes to Astro 7 types

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Build the demo on Astro 7 and fix build/integration breakages

**Files:**
- Modify (as triage requires): `examples/demo/astro.config.mjs`, `examples/demo/wrangler.jsonc`, and any `src/integration.ts` runtime wiring surfaced only at build time.

**Interfaces:**
- Consumes: Tasks 1 & 3.
- Produces: `examples/demo` builds to `dist/` on Astro 7 with the CMS integration applied.

- [ ] **Step 1: Clear demo caches (stale-bundle guard)**

```bash
cd /Users/tomotakayajima/Desktop/yjm/git/astro-cloudflare-cms
rm -rf examples/demo/{dist,.astro,node_modules/.vite}
```

- [ ] **Step 2: Build the demo**

Run: `npm run build -w examples/demo`
Expected (likely): either success, or integration/adapter errors (e.g. `injectRoute` entrypoint resolution, middleware order, virtual module plugin, `output`/adapter mismatch).

- [ ] **Step 3: Triage and fix**

Resolve each build error in `src/integration.ts` (or the demo config) against Astro 7 + cloudflare 14. Keep `injectRoute`/`addMiddleware`/`injectTypes`/virtual-config-plugin behavior equivalent. Re-run Step 2 until the build is green.

- [ ] **Step 4: Verify the build output exists**

> Note (confirmed in Task 4): `@astrojs/cloudflare` v14 changed the output layout. It no longer emits `dist/_worker.js` / `dist/_routes.json`; it generates `dist/client/` plus `dist/server/{entry.mjs, wrangler.json}`. Also `main` must NOT be set in the source `wrangler.jsonc` (the v14 vite plugin validates `main` at config time before the build exists).

Run: `ls examples/demo/dist/server/entry.mjs && ls examples/demo/dist/server/wrangler.json`
Expected: both exist.

- [ ] **Step 5: Commit**

```bash
git add packages/astro-cloudflare-cms/src examples/demo/astro.config.mjs examples/demo/wrangler.jsonc
git commit -m "fix(build): demo builds with the CMS integration on Astro 7

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Runtime-verify the demo under wrangler dev

**Files:**
- Modify (as triage requires): only spots that fail at runtime.

**Interfaces:**
- Consumes: Task 4 build.
- Produces: a working demo on Astro 7 — admin login, article CRUD, image upload, public `/news` all functional.

- [ ] **Step 1: Start wrangler dev against the adapter-generated config**

> Note (from Task 4): with `@astrojs/cloudflare` v14 the runnable worker config is the **generated** `examples/demo/dist/server/wrangler.json` (it has the correct `main: entry.mjs` and `assets.directory: ../client`). The source `examples/demo/wrangler.jsonc` no longer drives the run (its `assets.directory: "dist"` is stale/ignored). Run from `examples/demo` so the existing local D1/R2 persistence in `examples/demo/.wrangler/` (which holds the seeded master `admin@example.com` / `admin1234`) is reused.

```bash
cd examples/demo && npx wrangler dev --config dist/server/wrangler.json
```
Expected: `Ready on http://localhost:8788` with DB/MEDIA bindings (local). If the exact flag/path differs on this adapter version, determine the correct invocation from the generated `dist/server/wrangler.json` and the adapter docs; the goal is a running worker that uses `examples/demo/.wrangler/` persistence (so login with the seeded master works). If `--persist-to` is needed to point at `examples/demo/.wrangler`, add it. Also note whether `npx astro dev` now serves D1/R2 locally via the v14 vite plugin (a possible Phase-1 finding) — but the gate here is a working run, by whatever supported path uses the seeded local data.

- [ ] **Step 2: Smoke the key endpoints**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8788/admin/login; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8788/news`
Expected: `200` and `200`.

- [ ] **Step 3: Browser-verify the core flows**

Using Playwright (or a browser): log in (`admin@example.com` / `admin1234`), open the editor (toolbar + typography render), create/save an article, confirm it on `/news`. Fix any runtime regressions (hydration, `locals.runtime.env`, media proxy) and re-verify.

- [ ] **Step 4: Commit (only if Step 3 required fixes)**

```bash
git add -A
git commit -m "fix(runtime): demo admin/news work under wrangler dev on Astro 7

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Full green gate

**Interfaces:**
- Consumes: all prior tasks.
- Produces: the Phase 1 done-definition met.

- [ ] **Step 1: Typecheck**

Run: `cd packages/astro-cloudflare-cms && npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 2: Unit tests**

Run: `npm test`
Expected: 106 passed (or more if Task 2 added tests).

- [ ] **Step 3: CSS still builds (no class changes expected, but confirm pipeline)**

Run: `npm run build:css` and confirm `styles.css` is unchanged or rebuilds cleanly. If unchanged, no commit needed.

- [ ] **Step 4: Demo build**

Run: `cd .. && npm run build -w examples/demo`
Expected: Complete.

---

### Task 7: Record Phase 1 findings (feeds Phases 2–5)

**Files:**
- Modify: `docs/superpowers/specs/2026-06-29-web-studio-cms-retarget-design.md` (append section)

**Interfaces:**
- Consumes: the actual breakages/fixes from Tasks 2–5.
- Produces: a concrete "Phase 1 findings" note so the Phase 2–5 plans can be written against the real Astro 7 API surface.

- [ ] **Step 1: Append a findings section**

Append a `## Phase 1 findings (Astro 7 migration)` section listing: what broke and how it was fixed (integration API, adapter, output, types, vitest pool/patch), the final resolved versions, and anything that affects Phases 2–5 (e.g. how `injectRoute`/`prerender`/`output` now behave in Astro 7 — directly informs Phase 2 hybrid rendering).

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-06-29-web-studio-cms-retarget-design.md
git commit -m "docs(spec): record Astro 7 migration findings (Phase 1)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

- **Spec coverage:** This plan implements spec **Phase 1** only (Astro 7 / cloudflare 14 / react 6 foundation + green gates) plus the vitest-pool/patch item. Spec Phases 2 (hybrid rendering), 3 (`/news` theme injection), 4 (admin on Astro 7 — partially covered by Tasks 3–5 runtime verification), and 5 (init DX + real-host verification) are intentionally deferred to follow-up plans written from the Phase 1 baseline. The Tailwind v4 alignment in the spec's Phase 1 title is deferred to Phase 3 (public theming); noted in Global Constraints.
- **Placeholder scan:** Triage tasks (2–5) intentionally specify *process + gates + known breakage areas* rather than pre-written diffs, because the exact fixes are unknowable until the Astro 7 build runs. This is the nature of a migration spike, not a hidden placeholder; Task 7 captures the real fixes.
- **Type consistency:** No new cross-task symbols are introduced (this is a migration); the "interfaces" are the existing integration/route/`App.Locals` surfaces, kept equivalent.

## Note on later phases

Phases 2–5 will each get their own plan once Task 7's findings establish the real Astro 7 API surface. Writing their exact tasks now would be speculative (the integration API and `prerender`/`output` behavior in Astro 7 directly shape them).
