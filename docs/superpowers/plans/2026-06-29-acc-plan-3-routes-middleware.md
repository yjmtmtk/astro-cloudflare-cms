# astro-cloudflare-cms — Plan 3: Routes, Middleware & Config Plumbing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Make the server-side CMS work when injected into the host: port the auth middleware and all API + media routes from `nanocms` into the integration package as `injectRoute`/`addMiddleware` entrypoints, expose the resolved options to those files via a `virtual:acc-config` module so user-facing path prefixes are configurable, provide `App.Locals` types via `injectTypes`, and verify end-to-end against the demo (curl login → CRUD → upload → media serve).

**Architecture:** Routes/middleware live in the package and are compiled in the HOST's Astro/Vite build, so their imports must be **relative** (no `@/` alias, which would resolve to the host's `src`). Hardcoded URLs (`/admin`, `/admin/login`) become `config.adminBasePath`-derived, where `config` comes from a virtual module the integration's Vite plugin serves from the resolved options. The lib (already ported, unit-tested) is unchanged; `/cms-media` stays fixed (the lib generates those URLs). The demo provides D1/R2 for an API smoke (migration applied + master seeded manually here; the CLI automates this in Stage 5).

**Tech Stack:** Plan 1–2 stack. Astro integration hooks `astro:config:setup` (`injectRoute`, `addMiddleware`, `updateConfig` for the Vite plugin) and `astro:config:done` (`injectTypes`).

## Global Constraints

- **Reference source:** `nanocms/playground` (`R`) at `/Users/tomotakayajima/Desktop/yjm/git/nanocms/playground`. Port route/middleware BODIES verbatim except the two transforms below.
- **Transform 1 — imports relative:** in every ported route/middleware file, replace `@/lib/X` with the correct relative path (e.g. from `src/routes/admin/api/login.ts` → `../../../lib/auth`). NO `@/` alias in runtime files.
- **Transform 2 — paths from config:** replace hardcoded admin/news URL literals with values from `import { config } from 'virtual:acc-config'` (`config.adminBasePath`, `config.newsBasePath`, `config.brand`, `config.defaultEyecatchUrl`). `/cms-media` stays a literal (lib-internal).
- **Bindings:** `DB`/`MEDIA`, env `SESSION_SECRET`/`PUBLIC_R2_BASE_URL`/`DEFAULT_EYECATCH_URL` via `locals.runtime.env` (unchanged).
- **`mediaBasePath` is effectively fixed at `/cms-media`** (the media route mounts there; the lib's `cmsMediaPath` emits `/cms-media/...`). Keep it out of the configurable surface for now.
- **No absolute machine paths.** Integration resolves entrypoints via `import.meta.url`.
- **Type-check:** the package's `tsc --noEmit` stays 0 errors; add a `virtual:acc-config` ambient module declaration.

---

## File Structure (Plan 3 scope, under `packages/astro-cloudflare-cms/`)

- Create: `src/virtual.d.ts` — ambient type for `virtual:acc-config`
- Create: `src/config-runtime.ts` — the `AccConfig` type shared by the virtual module + integration
- Modify: `src/options.ts` — re-export/`AccConfig` shape consistency
- Modify: `src/integration.ts` — virtual config Vite plugin, `addMiddleware`, `injectRoute` for all routes, `injectTypes`
- Create: `src/middleware.ts` — ported from `R/src/middleware.ts`, parameterized
- Create: `src/routes/admin/api/{login,logout,upload}.ts`, `.../articles/{index,[id]}.ts`, `.../categories/{index,[id]}.ts`, `.../users/{index,[id]}.ts` — ported from `R/src/pages/admin/api/**`
- Create: `src/routes/cms-media/[...key].ts` — ported from `R/src/pages/cms-media/[...key].ts`
- Delete: `src/routes/_health.ts` (Stage-1 probe, no longer needed)

---

### Task 1: Virtual config module + middleware + injectTypes

**Files:**
- Create: `src/config-runtime.ts`
- Create: `src/virtual.d.ts`
- Create: `src/middleware.ts` (← `R/src/middleware.ts`, parameterized)
- Modify: `src/integration.ts`
- Delete: `src/routes/_health.ts`

**Interfaces:**
- Produces: `virtual:acc-config` exporting `const config: AccConfig` where `AccConfig = { adminBasePath, newsBasePath, brand, defaultEyecatchUrl }`; the `/admin/*` guard middleware (added via `addMiddleware`, order `pre`); `App.Locals` types via `injectTypes`.

- [ ] **Step 1: `src/config-runtime.ts`** — the runtime config shape

```ts
export interface AccConfig {
  adminBasePath: string;
  newsBasePath: string;
  brand: string;
  defaultEyecatchUrl: string;
}
```

- [ ] **Step 2: `src/virtual.d.ts`** — ambient type for the virtual module

```ts
declare module 'virtual:acc-config' {
  import type { AccConfig } from './config-runtime';
  export const config: AccConfig;
}
```

- [ ] **Step 3: Port `src/middleware.ts`** from `R/src/middleware.ts`, parameterizing the admin path.

Read `R/src/middleware.ts`. Reproduce it with these changes:
- `import { config } from 'virtual:acc-config';` at top; import `resolveSession`, `SESSION_COOKIE` from `./lib/auth` (relative).
- `isProtectedAdminPath(pathname)` derives from `config.adminBasePath` instead of the literal `/admin`: public set = `[\`${config.adminBasePath}/login\`, \`${config.adminBasePath}/api/login\`]`; protected = `p === config.adminBasePath || p.startsWith(config.adminBasePath + '/')`.
- The unauth redirect target becomes `\`${config.adminBasePath}/login\``.
Keep the `onRequest`/`defineMiddleware` structure and the `locals.user` resolution identical.

> Note: `isProtectedAdminPath` was unit-tested in nanocms via `middleware.test.ts`, but that test imported the literal-path version. Since this version reads `config` from a virtual module (only available in the Astro build), it is NOT unit-tested here — it is covered by the demo smoke (Task 3). Do not port `middleware.test.ts`.

- [ ] **Step 4: Rewrite `src/integration.ts`** — virtual config plugin + middleware + injectTypes (routes are wired in Task 2; for now keep injecting nothing but set up the plumbing)

```ts
import type { AstroIntegration } from 'astro';
import { fileURLToPath } from 'node:url';
import { resolveOptions, type CmsOptions } from './options';
import type { AccConfig } from './config-runtime';

function virtualConfigPlugin(cfg: AccConfig) {
  const id = 'virtual:acc-config';
  const resolved = '\0' + id;
  return {
    name: 'acc:virtual-config',
    resolveId(source: string) { return source === id ? resolved : null; },
    load(thisId: string) { return thisId === resolved ? `export const config = ${JSON.stringify(cfg)};` : null; },
  };
}

export default function cms(options: CmsOptions = {}): AstroIntegration {
  const o = resolveOptions(options);
  const cfg: AccConfig = {
    adminBasePath: o.adminBasePath,
    newsBasePath: o.newsBasePath,
    brand: o.brand,
    defaultEyecatchUrl: o.defaultEyecatchUrl,
  };
  const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
  return {
    name: 'astro-cloudflare-cms',
    hooks: {
      'astro:config:setup': ({ addMiddleware, updateConfig, logger }) => {
        updateConfig({ vite: { plugins: [virtualConfigPlugin(cfg)] } });
        addMiddleware({ entrypoint: here('./middleware.ts'), order: 'pre' });
        logger.info(`astro-cloudflare-cms: middleware + virtual config ready (admin=${o.adminBasePath})`);
      },
      'astro:config:done': ({ injectTypes }) => {
        injectTypes({
          filename: 'astro-cloudflare-cms.d.ts',
          content: [
            "import type { SessionUser } from 'astro-cloudflare-cms/types';",
            'declare namespace App {',
            '  interface Locals {',
            '    runtime: { env: { DB: D1Database; MEDIA: R2Bucket; SESSION_SECRET: string; PUBLIC_R2_BASE_URL?: string; DEFAULT_EYECATCH_URL?: string } };',
            '    user: SessionUser | null;',
            '  }',
            '}',
          ].join('\n'),
        });
      },
    },
  };
}
```
> Add a `"./types"` export to the package `package.json` `exports` pointing at `./src/lib/types.ts` so the injected `App.Locals` type can import `SessionUser`. (e.g. `"./types": "./src/lib/types.ts"`).

- [ ] **Step 5: Delete `src/routes/_health.ts`** (and ensure nothing references it).

- [ ] **Step 6: Verify** — from repo root: `npm install` then `npm run build -w examples/demo`. Expected: builds; log shows the integration's `middleware + virtual config ready (admin=/admin)`. Then `cd packages/astro-cloudflare-cms && npx tsc --noEmit -p tsconfig.json` → 0 errors (the `virtual:acc-config` ambient decl resolves). Run `npm run test -w astro-cloudflare-cms` → still 75 (middleware not unit-tested; lib tests unchanged).

- [ ] **Step 7: Commit** `feat(integration): virtual config + admin-guard middleware + App.Locals types`

---

### Task 2: Port API routes + cms-media + wire injectRoute

**Files (← `R/src/pages/...`):**
- Create: `src/routes/admin/api/login.ts`, `logout.ts`, `upload.ts`
- Create: `src/routes/admin/api/articles/index.ts`, `[id].ts`
- Create: `src/routes/admin/api/categories/index.ts`, `[id].ts`
- Create: `src/routes/admin/api/users/index.ts`, `[id].ts`
- Create: `src/routes/cms-media/[...key].ts`
- Modify: `src/integration.ts` (add the `injectRoute` calls)

**Interfaces:** the full server-side CMS API + media serving, injected under `config.adminBasePath`/`/cms-media`.

- [ ] **Step 1: Port each route file** from the matching `R/src/pages/...` path. Apply Transform 1 (relative imports) to every `@/lib/...`. Apply Transform 2 to URL literals: in `login.ts` the success redirect `/admin`→`config.adminBasePath` and failure `/admin/login?error=1`→`` `${config.adminBasePath}/login?error=1` `` (import `config` from `virtual:acc-config`); in `logout.ts` `/admin/login`→`` `${config.adminBasePath}/login` ``. The other API routes return JSON (no URL literals) — only Transform 1 applies. `cms-media/[...key].ts` has no lib import — only confirm it reads `locals.runtime.env.MEDIA`.
- [ ] **Step 2: Add `injectRoute` calls** to `src/integration.ts` inside `astro:config:setup`, using `here('./routes/...')` entrypoints and option-derived patterns:
```ts
const admin = o.adminBasePath;
injectRoute({ pattern: `${admin}/api/login`,  entrypoint: here('./routes/admin/api/login.ts') });
injectRoute({ pattern: `${admin}/api/logout`, entrypoint: here('./routes/admin/api/logout.ts') });
injectRoute({ pattern: `${admin}/api/upload`, entrypoint: here('./routes/admin/api/upload.ts') });
injectRoute({ pattern: `${admin}/api/articles`,      entrypoint: here('./routes/admin/api/articles/index.ts') });
injectRoute({ pattern: `${admin}/api/articles/[id]`, entrypoint: here('./routes/admin/api/articles/[id].ts') });
injectRoute({ pattern: `${admin}/api/categories`,      entrypoint: here('./routes/admin/api/categories/index.ts') });
injectRoute({ pattern: `${admin}/api/categories/[id]`, entrypoint: here('./routes/admin/api/categories/[id].ts') });
injectRoute({ pattern: `${admin}/api/users`,      entrypoint: here('./routes/admin/api/users/index.ts') });
injectRoute({ pattern: `${admin}/api/users/[id]`, entrypoint: here('./routes/admin/api/users/[id].ts') });
injectRoute({ pattern: `/cms-media/[...key]`, entrypoint: here('./routes/cms-media/[...key].ts') });
```
- [ ] **Step 3: Verify build + types** — `npm run build -w examples/demo` succeeds and the build log lists the injected routes; `npx tsc --noEmit -p tsconfig.json` (package) → 0 errors.
- [ ] **Step 4: Commit** `feat(integration): inject CMS API + media routes (relative imports, config paths)`

---

### Task 3: Demo API smoke (end-to-end server-side CMS)

**Files:** none (verification; may add `examples/demo` local-only files that are git-ignored).

- [ ] **Step 1: Prepare the demo's local D1** — from `examples/demo`: apply the package's migration to the demo's local D1:
```bash
cd examples/demo
cp ../../packages/astro-cloudflare-cms/migrations/0001_init.sql ./migrations/0001_init.sql 2>/dev/null || (mkdir -p migrations && cp ../../packages/astro-cloudflare-cms/migrations/0001_init.sql ./migrations/0001_init.sql)
npx wrangler d1 migrations apply acc_demo_db --local
```
- [ ] **Step 2: Seed a master user** into the demo's local D1 (PBKDF2 via node, matching `auth.ts`):
```bash
node --input-type=module <<'EOF' > /tmp/acc_seed.sql
const pw = "admin1234";
const enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));
const km = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
const bits = await crypto.subtle.deriveBits({ name:"PBKDF2", salt, iterations:100000, hash:"SHA-256" }, km, 256);
const b64 = (u) => Buffer.from(u).toString("base64");
console.log(`INSERT INTO users (id,email,password_hash,password_salt,role,name,created_at) VALUES ('${crypto.randomUUID()}','admin@example.com','${b64(new Uint8Array(bits))}','${b64(salt)}','master','管理者',strftime('%s','now'));`);
EOF
npx wrangler d1 execute acc_demo_db --local --file=/tmp/acc_seed.sql
```
- [ ] **Step 3: Build + run + curl the API end-to-end** — `npm run build` then `npx wrangler dev --port 8820` (background). With a cookie jar and a matching `Origin` header (Astro CSRF on form POSTs):
  - `POST /admin/api/login` (form, `-H "Origin: http://localhost:8820"`, save jar) with the seeded creds → 303 to `/admin` + `Set-Cookie nanocms_session`.
  - `GET /admin/api/articles` (no cookie) → 403 (middleware/guard). With jar → 200 `[]`.
  - `POST /admin/api/categories` (JSON, jar) `{"name":"News"}` → 201 + slug.
  - `POST /admin/api/articles` (JSON, jar) `{"title":"Hi","body":"<p>x</p>","status":"published"}` → 201 + slug + author_id.
  - `GET /admin/api/articles` (jar) → contains the article.
  Capture each status. Stop the background wrangler. (`.wrangler/` is git-ignored.)
  > If `wrangler dev` can't be driven, build + tsc are the floor; report DONE_WITH_CONCERNS naming the uncaptured checks. Do not weaken anything.
- [ ] **Step 4: Commit** `chore: verify Stage 3 (injected CMS API works end-to-end in the demo)` (empty if no files changed) — keep the demo's `migrations/0001_init.sql` copy committed (it's part of the demo).

---

## Self-Review

**1. Spec coverage (spec §3 integration API + §6 stage 3):** `injectRoute` for all API/media routes (Task 2) ✓; `addMiddleware` guard (Task 1) ✓; `injectTypes` App.Locals (Task 1) ✓; configurable path prefixes via `virtual:acc-config` (Tasks 1–2) ✓; bindings DB/MEDIA unchanged ✓. Deferred: page routes + components + bundled CSS (Stage 4); CLI automation of migrate/seed (Stage 5 — done manually here for verification).

**2. Placeholder scan:** No TBD. The "read `R/...` and reproduce with transforms" steps reference verbatim-but-transformed source (the two transforms are explicit). The demo smoke uses concrete curl steps.

**3. Type/interface consistency:** `AccConfig` (config-runtime.ts) shape matches `resolveOptions` output keys (minus `mediaBasePath`, intentionally fixed); `virtual:acc-config` ambient decl (virtual.d.ts) matches; injected `App.Locals` imports `SessionUser` via the new `./types` package export; relative-import rule applied uniformly to runtime files (the Stage-2 portability decision).
