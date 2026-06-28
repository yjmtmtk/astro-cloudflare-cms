# astro-cloudflare-cms — Plan 2: Core Port (lib + migrations + tests) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Port the proven, already-reviewed CMS core (D1 schema, domain types, all `lib/*` modules, and their tests) from the reference project `nanocms` into `packages/astro-cloudflare-cms`, standing up the Cloudflare workers-pool vitest harness so the full ported test suite passes against real local D1 + R2.

**Architecture:** This is a PORT of working code, not new development. The reference source is `nanocms/playground` (every file there is already TDD'd, reviewed, and merged). The `lib/` modules use **relative** internal imports already, so they copy nearly verbatim. Tests reference modules via a `@/` alias that the **package's own vitest config** maps to the package `src/` (this alias is test-only and never leaks into the host build). The test harness mirrors nanocms: `@cloudflare/vitest-pool-workers` with inline miniflare D1/R2 bindings, `readD1Migrations` + an `apply-migrations` setup file, and a committed `patch-package` patch for the pool's WAL-teardown bug.

**Tech Stack:** Plan 1 stack + runtime deps `nanoid`, `ultrahtml`; dev deps `@cloudflare/vitest-pool-workers`, `@cloudflare/workers-types`, `patch-package`. Web Crypto (workerd).

## Global Constraints

- **Reference source of truth:** `nanocms/playground` at `/Users/tomotakayajima/Desktop/yjm/git/nanocms/playground`. Port files VERBATIM unless a rule below requires a change. Do not "improve" ported logic — it is reviewed and tested.
- **Destination package:** `/Users/tomotakayajima/Desktop/yjm/git/astro-cloudflare-cms/packages/astro-cloudflare-cms` (paths below are relative to this unless noted).
- **Imports:** `lib/*` modules keep their existing **relative** internal imports (e.g. `./types`, `./media-url`) — copy as-is. **Tests** keep `@/lib/...` imports, resolved by the package's `vitest.config.ts` `resolve.alias` (`@` → `<pkg>/src`). Do NOT introduce a `@/` alias anywhere that the host build would see (no Vite alias in the integration).
- **Bindings (tests):** D1 `DB`, R2 `MEDIA` via inline miniflare config (the package has no wrangler.jsonc of its own).
- **Time:** integer epoch seconds, UTC. **compatibilityDate for the test pool:** `2025-02-04` (miniflare bundled ceiling — avoids the fallback warning); the HOST runtime uses `2025-09-01` (demo wrangler, Plan 1).
- **WAL patch:** `@cloudflare/vitest-pool-workers@0.6.x` exits non-zero on R2 isolated-storage teardown; reuse nanoms's committed patch via `patch-package` + a `postinstall` script.
- **Type-check gate:** `npx tsc --noEmit -p tsconfig.json` (package) reports 0 errors before each commit.
- **No absolute machine paths** in committed files.

---

## Files Ported (reference → destination, under `packages/astro-cloudflare-cms/`)

Reference base `R = nanocms/playground`. All `src/lib/*` and `test/*` below come from `R/src/lib/*` and `R/test/*`.

- `migrations/0001_init.sql` ← `R/migrations/0001_init.sql`
- `src/lib/{types,slug,authz,media-url,eyecatch,image,sanitize-html-body,render-body,auth,db,db-articles,db-categories,db-users,media}.ts` ← same paths under `R/src/lib/`
- `test/{slug,authz,media-url,eyecatch,image,sanitize,render-body,auth,session,db,db-categories,db-users,db-articles-public?,media}.test.ts` ← from `R/test/` (port the ones that exist for the modules in scope; `db-articles-public` belongs to public visibility and IS in scope here since `db-articles.ts` includes `listPublicArticles`)
- `test/apply-migrations.ts`, `test/env.d.ts` ← `R/test/`
- `vitest.config.ts` ← adapted from `R/vitest.config.ts` (remove Astro-specific bits; keep workers pool + readD1Migrations + alias + setup)
- `patches/@cloudflare+vitest-pool-workers+0.6.16.patch` ← `R/patches/`
- `tsconfig.json` (modify: add `@cloudflare/workers-types`), `package.json` (modify: add deps + postinstall)

> Note exact test filenames by listing `R/test/`. Port every `*.test.ts` whose module is ported in this plan. The article-list test (`db-articles.test.ts`) and the public-visibility test (`db-articles-public.test.ts`) both belong to `db-articles.ts` (Task 4).

---

### Task 1: Test harness + deps + migration + domain types (schema smoke)

**Files:**
- Modify: `package.json` (add deps + postinstall)
- Modify: `tsconfig.json` (add workers-types)
- Create: `migrations/0001_init.sql` (← R)
- Create: `src/lib/types.ts` (← R)
- Create: `vitest.config.ts` (replace the Plan-1 plain-node config)
- Create: `test/apply-migrations.ts`, `test/env.d.ts` (← R)
- Create: `patches/@cloudflare+vitest-pool-workers+0.6.16.patch` (← R)

**Interfaces:**
- Produces: the workers-pool test environment (real `env.DB`/`env.MEDIA`, migrations auto-applied, per-test isolated storage), the v1 schema, and the domain types (`Role`, `ArticleStatus`, `UserRow`, `SessionRow`, `CategoryRow`, `ArticleRow`, `MediaRow`, `SessionUser`).

- [ ] **Step 1: Add deps + postinstall to `package.json`**

Add to `packages/astro-cloudflare-cms/package.json`:
```jsonc
// dependencies:
"nanoid": "^5.0.0",
"ultrahtml": "^1.5.3",
// devDependencies (add to existing astro/typescript/vitest):
"@cloudflare/vitest-pool-workers": "^0.6.0",
"@cloudflare/workers-types": "^4.20240000.0",
"patch-package": "^8.0.0",
// scripts: add
"postinstall": "patch-package"
```
(Match the exact versions nanocms used where possible — check `R/package.json`. `ultrahtml` version = whatever `R` pins.)

- [ ] **Step 2: Port migration + types + test setup + patch**

Copy verbatim from `R`:
- `R/migrations/0001_init.sql` → `migrations/0001_init.sql`
- `R/src/lib/types.ts` → `src/lib/types.ts`
- `R/test/apply-migrations.ts` → `test/apply-migrations.ts`
- `R/test/env.d.ts` → `test/env.d.ts`
- `R/patches/`*.patch → `patches/`

- [ ] **Step 3: Create the package `vitest.config.ts`** (workers pool; adapted from `R/vitest.config.ts`)

```ts
import path from 'node:path';
import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, 'migrations'));
  return {
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    test: {
      setupFiles: ['./test/apply-migrations.ts'],
      poolOptions: {
        workers: {
          singleWorker: true,
          miniflare: {
            compatibilityDate: '2025-02-04',
            compatibilityFlags: ['nodejs_compat'],
            d1Databases: ['DB'],
            r2Buckets: ['MEDIA'],
            bindings: { SESSION_SECRET: 'test-secret', TEST_MIGRATIONS: migrations },
          },
        },
      },
    },
  };
});
```

- [ ] **Step 4: Add workers-types to `tsconfig.json`** — set `"types": ["@cloudflare/workers-types", "@cloudflare/vitest-pool-workers"]` in compilerOptions.

- [ ] **Step 5: Install + schema smoke test**

Create a temporary `test/_schema.smoke.test.ts`:
```ts
import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
describe('schema', () => {
  it('migration applied: all tables exist', async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all<{ name: string }>();
    const names = results.map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(['articles', 'categories', 'media', 'sessions', 'users']));
  });
});
```
Run from repo root:
```bash
npm install
npm run test -w astro-cloudflare-cms
```
Expected: PASS (the apply-migrations setup applied the real migration). If vitest exits non-zero but tests pass, run `npx patch-package` (postinstall should have applied it) and re-run. Then delete `test/_schema.smoke.test.ts`.

- [ ] **Step 6: `npx tsc --noEmit -p tsconfig.json`** (from the package dir) → 0 errors.

- [ ] **Step 7: Commit**

```bash
git add packages/astro-cloudflare-cms package.json
git commit -m "feat(core): workers-pool test harness, v1 schema, domain types"
```

---

### Task 2: Port pure-logic lib + tests (slug, authz, media-url, eyecatch, image, sanitize, render-body)

**Files (← `R`):**
- Create: `src/lib/{slug,authz,media-url,eyecatch,image,sanitize-html-body,render-body}.ts`
- Create: `test/{slug,authz,media-url,eyecatch,image,sanitize,render-body}.test.ts`

**Interfaces:** Produces the pure utilities + the security-critical sanitizer (default-deny allowlist, attribute-value cleaning) exactly as reviewed in nanocms.

- [ ] **Step 1: Copy the 7 lib modules verbatim** from `R/src/lib/` to `src/lib/`. Their internal imports are already relative — no changes.
- [ ] **Step 2: Copy the matching test files verbatim** from `R/test/` to `test/`. They import via `@/lib/...` (resolved by the package vitest alias) — no changes.
- [ ] **Step 3: Run** `npm run test -w astro-cloudflare-cms` → all ported tests pass (slug, authz, media-url, eyecatch, image, sanitize incl. the XSS/quote-breakout/comment cases, render-body). Capture the count.
- [ ] **Step 4:** `npx tsc --noEmit -p tsconfig.json` → 0 errors.
- [ ] **Step 5: Commit** `feat(core): port pure-logic lib (slug/authz/media-url/eyecatch/image/sanitize/render-body) + tests`

---

### Task 3: Port auth + db (+ auth/session/db tests)

**Files (← `R`):**
- Create: `src/lib/auth.ts`, `src/lib/db.ts`
- Create: `test/auth.test.ts`, `test/session.test.ts`, `test/db.test.ts`

**Interfaces:** PBKDF2 hashing (`hashPassword`/`verifyPassword`), session lifecycle (`login`/`resolveSession`/`logout`/`cookieAttributes(... , secure)`/`clearedCookie(secure)`/`SESSION_COOKIE`), and typed user/session D1 helpers — all as in nanocms.

- [ ] **Step 1: Copy `auth.ts` + `db.ts`** verbatim from `R/src/lib/` (relative imports intact).
- [ ] **Step 2: Copy `auth.test.ts`, `session.test.ts`, `db.test.ts`** verbatim from `R/test/`.
- [ ] **Step 3: Run** `npm run test -w astro-cloudflare-cms` → all pass (incl. the new auth/session/db cases). Capture count.
- [ ] **Step 4:** `npx tsc --noEmit -p tsconfig.json` → 0 errors.
- [ ] **Step 5: Commit** `feat(core): port auth (PBKDF2 + sessions) + db helpers + tests`

---

### Task 4: Port db-articles / db-categories / db-users (+ tests)

**Files (← `R`):**
- Create: `src/lib/{db-articles,db-categories,db-users}.ts`
- Create: `test/{db-articles,db-articles-public,db-categories,db-users}.test.ts` (port whichever of these exist in `R/test/` — list it first)

**Interfaces:** Article CRUD + filtered/public-visibility listing (`listArticles`, `listPublicArticles`, `getPublicArticleBySlug`, `getArticleBySlug`, `slugExists`, …), category CRUD, user list/update/delete + `countArticlesByAuthor`/`countMasters` — as in nanocms.

- [ ] **Step 1: List `R/test/`** to confirm which db-* test files exist; copy `db-articles.ts`/`db-categories.ts`/`db-users.ts` verbatim from `R/src/lib/`.
- [ ] **Step 2: Copy the matching test files** verbatim from `R/test/`.
- [ ] **Step 3: Run** `npm run test -w astro-cloudflare-cms` → all pass. Capture count.
- [ ] **Step 4:** `npx tsc --noEmit -p tsconfig.json` → 0 errors.
- [ ] **Step 5: Commit** `feat(core): port article/category/user db helpers + tests`

---

### Task 5: Port media lifecycle (+ media tests); full suite green

**Files (← `R`):**
- Create: `src/lib/media.ts`
- Create: `test/media.test.ts`

**Interfaces:** `extractMediaKeys`, `insertMedia`, `listMediaByArticle`, `deleteMediaByKeys`, `storeUpload`, `reconcileArticleMedia`, `cascadeDeleteArticleMedia`, `gcOrphans`, consts `ORPHAN_GRACE_HOURS`/`RECONCILE_GRACE_SECONDS` — the orphan-management core, with the tightened regex and DB-before-R2 delete order from nanocms.

- [ ] **Step 1: Copy `media.ts`** verbatim from `R/src/lib/media.ts`.
- [ ] **Step 2: Copy `media.test.ts`** verbatim from `R/test/media.test.ts` (real D1 + R2 reconcile/cascade/gc cases).
- [ ] **Step 3: Run the FULL suite** `npm run test -w astro-cloudflare-cms` → all ported tests pass, exit 0 (the patch-package WAL fix must keep exit 0 with R2 in tests). Capture the full file/test count.
- [ ] **Step 4:** `npx tsc --noEmit -p tsconfig.json` → 0 errors.
- [ ] **Step 5: Commit** `feat(core): port media lifecycle (reconcile/cascade/24h GC) + tests`

---

## Self-Review

**1. Spec coverage (spec §6 stage 2 + §7 port):** all `lib/*` modules + migrations + tests ported (Tasks 1–5) ✓; workers-pool harness + WAL patch (Task 1) ✓; security (sanitizer, auth, media GC) preserved verbatim (Tasks 2,3,5) ✓. Deferred: routes/middleware/types injection (Stage 3), UI + bundled CSS (Stage 4), CLI (Stage 5).

**2. Placeholder scan:** No TBD. The "list `R/test/` to confirm filenames" steps are deliberate (the exact set of db-* test files is discovered, not guessed). The `_schema.smoke.test.ts` is created then deleted (Task 1), like nanocms.

**3. Type/interface consistency:** ported modules keep their nanocms signatures verbatim; tests reference them via the package `@` alias (Task 1 vitest config). The runtime `lib/*` imports stay relative (no host-visible `@/` alias) — the key portability rule. `compatibilityDate` split (test `2025-02-04` vs host `2025-09-01`) matches nanocms's resolution of the miniflare ceiling.
