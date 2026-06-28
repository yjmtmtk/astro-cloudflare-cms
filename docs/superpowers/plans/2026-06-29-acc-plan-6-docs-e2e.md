# astro-cloudflare-cms — Plan 6: Publish-readiness, Docs & Acceptance E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Finish the project against the spec's acceptance criteria (§8): make the package publish-ready (metadata, exports, shipped files, no absolute paths), write the npm-facing README + docs (quickstart, options, CLI, the `wrangler dev` R2 requirement), polish the one known hydration warning, and verify the full host-integration acceptance flow end-to-end in the demo (login → article with body image + eyecatch → R2/`/cms-media` → future-date hidden/preview → delete cleans R2 → configurable prefix).

**Architecture:** No new runtime architecture — this stage hardens and documents what Stages 1–5 built. The package ships TS source (compiled in the host build), a bundled `styles.css`, `migrations/`, and the `bin/` CLI; the README documents the 3-step host adoption (`npm i` → add `cms()` → `npx astro-cloudflare-cms init`). The acceptance E2E runs under `npx wrangler dev` (R2 writes require it — `astro dev`'s platformProxy can't write R2).

**Tech Stack:** Plan 1–5 stack. Docs in Markdown. E2E via Playwright against `wrangler dev`.

## Global Constraints

- **Self-contained:** no absolute machine paths anywhere in `packages/astro-cloudflare-cms/src`, `bin`, or config (entrypoints resolve via `import.meta.url`). A grep gate enforces this.
- **Publishable structure:** `npm pack --dry-run` must include `src/`, `migrations/`, `styles.css`, `bin/` and exclude tests/scratch. `exports` expose the integration (`.`), `./types`, and `./styles.css`.
- **Acceptance criteria are the gate** (spec §8): the E2E task must exercise each integration-level criterion or explicitly note which are covered by unit tests (sanitize, authz, image-resize) vs browser.
- **`wrangler dev` for R2:** docs MUST state that image upload / media GC require `npx wrangler dev` (not `astro dev`).
- **Commits:** plain `git commit` (repo identity `yjmtmtk <tomotaka.yajima@gmail.com>`; no `-c`); body ends with the Claude `Co-Authored-By` trailer.

---

## File Structure (Plan 6 scope)

- Modify: `packages/astro-cloudflare-cms/package.json` (metadata + `exports` `./styles.css`)
- Create: `packages/astro-cloudflare-cms/README.md` (npm-facing)
- Create: `README.md` (repo root — overview + monorepo map + dev)
- Create: `examples/demo/README.md` (run the demo)
- Modify: `packages/astro-cloudflare-cms/src/components/ArticleForm.tsx` (hydration polish — Task 3)

---

### Task 1: Publish-readiness

**Files:** modify `packages/astro-cloudflare-cms/package.json`.

**Interfaces:** the package's published shape — metadata, `exports` (`.`, `./types`, `./styles.css`), shipped `files`.

- [ ] **Step 1: Add package metadata** to `package.json`: `"description": "Drop-in D1+R2 CMS for Astro + Cloudflare + React sites — an Astro integration that injects admin UI, public /news, auth, and media."`, `"keywords": ["astro","astro-integration","cloudflare","d1","r2","cms","react"]`, `"license": "MIT"`, `"author": "yjmtmtk"`, `"repository": { "type": "git", "url": "https://github.com/yjmtmtk/astro-cloudflare-cms" }`, `"homepage"` same. Bump `"version"` to `"0.1.0"`. Keep `type: module`.
- [ ] **Step 2: Add `"./styles.css": "./styles.css"`** to the `exports` map (so hosts can `import 'astro-cloudflare-cms/styles.css'` if they ever need it directly; the page routes already import it relatively). Keep `.` → `./src/integration.ts` and `./types` → `./src/lib/types.ts`.
- [ ] **Step 3: Absolute-path gate** — run `grep -rnE "/Users/|/home/|/private/tmp" packages/astro-cloudflare-cms/src packages/astro-cloudflare-cms/bin` → expect NO matches (only `import.meta.url`-relative resolution). If any found, that's a defect to fix before proceeding.
- [ ] **Step 4: `npm pack --dry-run`** in the package dir → confirm the tarball lists `src/**`, `migrations/0001_init.sql`, `styles.css`, `bin/cli.mjs`, `package.json`, `README.md`, and does NOT include `test/**` or `.superpowers`. Capture the file list.
- [ ] **Step 5: Type-check + tests still green** — `npx tsc --noEmit -p tsconfig.json` → 0; `npm run test -w astro-cloudflare-cms` → 82 pass.
- [ ] **Step 6: Commit** `chore(pkg): publish-ready metadata + styles.css export`

---

### Task 2: README & docs

**Files:** create `packages/astro-cloudflare-cms/README.md`, `README.md` (root), `examples/demo/README.md`.

**Interfaces:** user-facing documentation.

- [ ] **Step 1: Write `packages/astro-cloudflare-cms/README.md`** (the npm page) with these sections:
  - **What it is:** one paragraph — an Astro integration that injects a D1+R2 CMS (admin UI, public `/news`, self-hosted auth, client-resized media) into an existing Astro + Cloudflare + React site; host needs no Tailwind/shadcn.
  - **Requirements:** Astro 5 (`output: 'server'`), `@astrojs/cloudflare`, React 19, a Cloudflare account (D1+R2). Note `compatibility_date >= 2025-09-01` + `nodejs_compat`.
  - **Quickstart (3 steps):**
    1. `npm i astro-cloudflare-cms`
    2. add to `astro.config.mjs`: `import cms from 'astro-cloudflare-cms'; integrations: [react(), cms()]`
    3. `npx astro-cloudflare-cms init` (creates D1/R2, merges wrangler config, applies the migration, writes `SESSION_SECRET`, seeds the master), then `npm run build && npx wrangler dev`.
  - **Options table:** `adminBasePath` (default `/admin`), `newsBasePath` (default `/news`), `brand` (default `astro-cloudflare-cms`), `defaultEyecatchUrl` (default empty → gradient placeholder). Show a configurable-prefix example (`cms({ newsBasePath: '/blog', brand: 'My Site' })`).
  - **CLI:** `npx astro-cloudflare-cms init [--local] [--db-name] [--bucket-name] [--master-email] [--master-password] [--yes]` — idempotent/resumable; `--local` sets up local-only (miniflare) without an account.
  - **Important — `wrangler dev` for media:** image upload and orphan media GC need `npx wrangler dev` (R2 writes don't work under `astro dev`'s platformProxy).
  - **Features:** master/author roles; articles with category, scheduled publish date (future = hidden until the date; logged-in preview), title, sanitized HTML body, published/hidden; client-side image resize to ≤1280px webp; eyecatch with gradient-placeholder fallback; orphan media reconcile/cascade/24h GC.
  - **Security note:** self-hosted PBKDF2 auth, opaque D1 sessions, default-deny HTML sanitizer; set a strong `SESSION_SECRET` in production (`npx wrangler secret put SESSION_SECRET`).
- [ ] **Step 2: Write the root `README.md`** — project overview, the monorepo map (`packages/astro-cloudflare-cms`, `examples/demo`), dev commands (`npm install`, `npm test`, `npm run build:css -w astro-cloudflare-cms`, `npm run build -w examples/demo`), and a link to the package README + the design spec.
- [ ] **Step 3: Write `examples/demo/README.md`** — how to run the demo locally: `npm install` (root), then in `examples/demo`: `npx astro-cloudflare-cms init --local --yes --master-email a@b.c --master-password ...` (or reuse the existing local D1), `npm run build && npx wrangler dev`, open `/admin/login`. Note R2 needs `wrangler dev`.
- [ ] **Step 4: Commit** `docs: package README + root + demo docs`

---

### Task 3: Hydration polish (datetime default)

**Files:** modify `packages/astro-cloudflare-cms/src/components/ArticleForm.tsx`.

**Interfaces:** no API change — fixes the React #418 hydration mismatch on `/admin/articles/new` (the 公開日時 default initialized to "now" differs SSR vs client).

- [ ] **Step 1: Locate the datetime default** in `ArticleForm.tsx` — the `publishedAt`/公開日時 state initialized from the current time during render (for the new-article case where no article is passed).
- [ ] **Step 2: Make the default client-only** — initialize the new-article publish datetime to `''` (empty) on first render, and set it to the formatted "now" inside a `useEffect(() => { ... }, [])` (runs only on the client, after hydration), guarded so it does NOT overwrite an existing article's loaded value. This makes SSR and the first client render agree (both empty), eliminating the mismatch; the field then fills in on mount. Keep the existing date formatting helper.
- [ ] **Step 3: Rebuild + verify** — `npm run build -w examples/demo`; with `npx wrangler dev`, open `/admin/articles/new` in the browser and confirm the browser console shows **no React #418** error and the 公開日時 field still populates with the current time. (Done in Task 4's session is acceptable — note the result there.)
- [ ] **Step 4: Type-check** `npx tsc --noEmit -p tsconfig.json` → 0; **Commit** `fix(ui): avoid hydration mismatch on new-article publish-date default`

---

### Task 4: Comprehensive acceptance E2E (controller-run)

**Files:** none (verification in the demo under `wrangler dev`).

> Run by the controller (browser + wrangler). Reuses the demo's local D1 (master `admin@example.com`/`admin1234` from Stage 4) — or run `init --local` to (re)provision.

- [ ] **Step 1: Build + serve** the demo under `npx wrangler dev` (R2 requires it).
- [ ] **Step 2: Article with media** — create a published article: set a title, upload an **eyecatch image** (verify it client-resizes and renders from `/cms-media/...`), insert a **body image** via the Tiptap editor, save. Confirm the article renders at `/news/<slug>` with the eyecatch and the body image (both served from `/cms-media`).
- [ ] **Step 3: Future-date hiding + preview** — create an article with a publish datetime in the future. Confirm: logged-OUT `/news` does NOT list it and `/news/<slug>` is hidden/404; logged-IN, it shows with a preview banner. (Open `/news` in a fresh context / clear the session cookie to check the logged-out view.)
- [ ] **Step 4: Delete → media cleanup** — delete an article that has media; confirm (via `npx wrangler r2 object get`/list against the local bucket, or the admin no longer referencing it) that its R2 objects are cleaned (no orphans) per the cascade/reconcile logic.
- [ ] **Step 5: Configurable prefix** — temporarily set `cms({ newsBasePath: '/blog' })` in the demo's `astro.config.mjs`, rebuild, confirm the public list serves at `/blog` (and `/news` 404s); then revert to `/news` and rebuild. (Proves the prefix option threads through routes + components.)
- [ ] **Step 6: Note unit-covered criteria** — record that sanitize (`<script>`/handlers/attr-breakout/comments), authz (author can't edit others'), and image resize-to-1280-webp are covered by the package unit tests (sanitize/authz/image suites), with the file names.
- [ ] **Step 7: Commit** `chore: verify Stage 6 acceptance E2E (media, future-date, cleanup, prefix)` (empty if no repo files changed). Capture screenshots/output as evidence.
  > If any browser step can't be driven, fall back to the equivalent API/curl check and report DONE_WITH_CONCERNS naming what was visually unverified. Do NOT weaken any feature to make a check pass.

---

## Self-Review

**1. Spec coverage (spec §8 acceptance):** login→article(category/date/body-image/eyecatch)→publish (T4 §2) ✓; future-date hidden/preview (T4 §3) ✓; image 1280-webp→R2→/cms-media + delete cleans R2 (T4 §2,§4; resize unit-tested) ✓; body sanitized (unit-tested, noted T4 §6) ✓; author can't edit others (unit-tested, noted T4 §6) ✓; host needs no Tailwind/shadcn (Stage 4, re-confirmed) ✓; route prefix configurable (T4 §5) ✓; vitest green + tsc 0 (T1 §5) ✓; self-contained + file: install + publishable (T1 §3,§4) ✓. Docs (T2) + publish metadata (T1) + the `wrangler dev` note (T2) complete the "仕上げ".

**2. Placeholder scan:** No TBD. README sections are enumerated with concrete content; the E2E steps are concrete actions with pass conditions. The hydration fix names the exact mechanism (empty default + client `useEffect`).

**3. Type/interface consistency:** option names in the README (`adminBasePath`/`newsBasePath`/`brand`/`defaultEyecatchUrl`) match `src/options.ts`; CLI flags in the README match `init.mjs` (`--local`/`--db-name`/`--bucket-name`/`--master-email`/`--master-password`/`--yes`); `exports` keys (`.`/`./types`/`./styles.css`) match what the integration + injected types + pages consume; the `wrangler dev`/`compatibility_date 2025-09-01`/`nodejs_compat` facts match the integration + CLI.
