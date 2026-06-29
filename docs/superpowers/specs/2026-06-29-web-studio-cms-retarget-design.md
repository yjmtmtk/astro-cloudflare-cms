# Re-target astro-cloudflare-cms for web-studio (static-first) sites — Design

> Status: approved design (brainstorming). Next: implementation plan (writing-plans).
> Date: 2026-06-29.

## Background / why

`astro-cloudflare-cms` was originally built and verified against **Astro 5 +
Cloudflare Workers SSR + React**. Its real purpose, however, is to add a CMS to
sites produced by the **web-studio** skill. Those sites have a very different
profile from what the package currently assumes, so the package needs to be
re-targeted and optimized for them.

### Target host profile (web-studio output)

- **Astro latest (currently 7.0.3)** + **Tailwind v4** via `@tailwindcss/vite`
  (no `tailwind.config`; `@import "tailwindcss"` + `@theme` tokens in
  `src/styles/global.css`).
- **Static-first**: builds to `dist/`, CDN-deployable, no adapter by default.
- **Typed `.astro` component kit**: `src/layouts/Layout.astro` (`<head>` OGP +
  fonts + favicon, `Header`/`<slot/>`/`Footer`), `Header.astro`, `Footer.astro`,
  reusable kit components (`Hero`/`Features`/`Gallery`/`CTA`…); pages in
  `src/pages/*.astro` compose the kit data-driven.
- **Design tokens are the contract**: `@theme` defines `--color-bg/ink/muted/
  brand/surface/line` and `--font-display/--font-body`; utilities like `bg-bg`,
  `text-ink`, `font-display`, `text-brand`, `border-line` are used everywhere.
- React only as islands where needed (`@astrojs/react`); rich motion via GSAP;
  images under `public/img/`.

### Gap vs the current package

| Aspect | Current package | web-studio host |
|---|---|---|
| Astro | 5 (peer `^5`) | **7** |
| Adapters | `@astrojs/cloudflare ^12`, `@astrojs/react ^4` | cloudflare `^14`, react `^6` |
| Rendering | Workers SSR everywhere | static-first |
| Public `/news` styling | self-bundled Tailwind v3 CSS (gray palette) | `@theme` tokens + host Layout |
| Tailwind | v3 (+ typography plugin) for the bundled `styles.css` | v4 `@theme` |

## Goal

Make the CMS a **hybrid add-on for web-studio sites**: keep the host's marketing
pages static, add the CMS's dynamic surfaces (public `/news`, `/admin`, API,
media) as on-demand routes on Cloudflare, and render the public `/news` so it
looks **native** to the web-studio design system. Adoption should be close to a
single `init` command.

## Confirmed decisions

1. **Delivery model = hybrid SSR (Cloudflare).** Marketing pages stay static
   (prerendered); `/news`, `/admin`, API, and `/cms-media` are on-demand (SSR).
   Deploy target becomes Cloudflare Workers.
2. **Public `/news` = theme injection.** The public pages render through the
   **host's `Layout.astro`** and the host's **`@theme` tokens**; the public-side
   self-bundled CSS is dropped.
3. **Theme injection is implemented by scaffolding `/news` into the host `src/`**
   at `init` time (ready-made drop-in, but editable). This is required so the
   pages can import the host Layout by relative path and so the host's Tailwind
   v4 build scans their markup to emit the token CSS. (Package-injected routes
   from `node_modules` are not reliably scanned by the host Tailwind and cannot
   relatively import the host Layout.)
4. **Admin UI keeps its current approach**: React islands + the package's own
   bundled `styles.css`. It lives behind auth and does not need to match the host
   design. Only its runtime correctness on Astro 7 / React 19 is in scope.

## Architecture

```
web-studio host (Astro 7, Tailwind v4, static-first)
├─ src/pages/*.astro            marketing pages  → prerendered (static)
├─ src/layouts/Layout.astro     host design system (head/Header/Footer/tokens)
├─ src/styles/global.css        @theme tokens (the contract)
│
├─ src/pages/news/              ← scaffolded by init (CMS, editable)
│   ├─ index.astro              uses Layout + tokens; data via package helpers
│   └─ [slug].astro
├─ src/components/news/         ← scaffolded typed kit: NewsList/NewsCard/Article
│
└─ (package-injected, SSR, prerender=false)
    ├─ /admin/**                React admin (bundled CSS, unchanged design)
    ├─ /admin/api/**            API routes
    └─ /cms-media/**            media proxy (fixed path)
```

- The package continues to own: integration wiring, middleware (admin guard),
  admin routes/components, API routes, `lib/**` (auth, db, media, sanitize,
  pagination, image), CLI, and the D1 migration.
- The package **exposes a small public data API** (e.g.
  `astro-cloudflare-cms/data`) that the scaffolded `/news` pages call for SSR
  fetches (`listPublicArticles`, `getPublicArticleBySlug`, eyecatch/render
  helpers). The scaffolded pages are the only place that knows the host Layout.

## Phased plan

### Phase 1 — Foundation: Astro 7 / Tailwind v4 / current adapters
- Bump `peerDependencies.astro` to `^7`; dev deps + `examples/demo` to
  `astro ^7`, `@astrojs/cloudflare ^14`, `@astrojs/react ^6` (react stays 19).
- Fix breakages from Astro 6→7 across `integration.ts` (injectRoute /
  addMiddleware / virtual config plugin / injectTypes), the cloudflare adapter,
  and `output` semantics.
- Update `@cloudflare/vitest-pool-workers` to a version compatible with the new
  stack; **regenerate or retire** `patches/@cloudflare+vitest-pool-workers+*.patch`.
- **Gate:** `tsc --noEmit` clean, vitest green, `examples/demo` builds and runs
  under `wrangler dev`.

### Phase 2 — Hybrid rendering
- Host stays `output: 'static'` (default) + Cloudflare adapter. CMS injected
  routes set `export const prerender = false` (on-demand); marketing pages remain
  static automatically.
- Confirm the admin/api/media/news routes are SSR while the host's own pages are
  untouched and still prerendered.

### Phase 3 — `/news` theme injection (core)
- `init` scaffolds into the host `src/`:
  - `src/pages/news/index.astro` and `src/pages/news/[slug].astro` (SSR,
    `prerender = false`), wrapping the host `Layout.astro`.
  - `src/components/news/NewsList.astro`, `NewsCard.astro`, `Article.astro` —
    typed kit using `@theme` token utilities (`bg-bg`, `text-ink`,
    `font-display`, `text-brand`, `border-line`).
- Data via `astro-cloudflare-cms/data` helpers (SSR).
- Layout reference: config `cms({ news: { layout: 'src/layouts/Layout.astro' } })`,
  defaulting to web-studio's conventional path; scaffolded pages import it.
- Article body: a small token-aware `news-content.css` (Tailwind v4 friendly, no
  typography plugin) styles headings/lists/quotes with `font-display` and tokens.
- **Drop the public-side bundled CSS.** Public visuals come entirely from the
  host's Tailwind v4 build of the scaffolded markup.

### Phase 4 — Admin on Astro 7 (keep current design)
- Admin remains React islands + bundled `styles.css`. Verify it builds and runs
  on Astro 7 / React 19; the bundled CSS is independent of the host. Migrating
  the admin's own CSS build to Tailwind v4 is **out of scope** for now (it is
  self-contained and works regardless of host Tailwind).

### Phase 5 — DX (`init`) + real-host verification
- Extend `init` to, for a web-studio host:
  - install/wire `@astrojs/cloudflare` + `@astrojs/react` and set the hybrid
    config; create/merge `wrangler.jsonc`; D1/R2 (or `--local`); apply migration;
    write `SESSION_SECRET`; seed master (existing behavior).
  - detect the host `Layout.astro` and scaffold the `/news` kit wired to it.
- Verify end-to-end against a real web-studio-style consumer (a fresh minimal
  web-studio site, or `test-site` after `astro add` conversions): `init --local`
  → `/news` renders natively (host Layout + tokens) → admin works → create an
  article via admin and via the CLI → article appears on `/news`.

## Testing strategy

- Unit (vitest, workers pool): existing 106 tests stay green; add tests for any
  new pure logic in the public data API and for `init`'s scaffolding helpers
  (path resolution, Layout detection, template rendering) where side-effect-free.
- Integration/manual: `wrangler dev` on the demo and on the web-studio consumer;
  browser verification of `/news` native styling and admin flows.

## Non-goals

- Re-skinning the admin UI to match the host design (stays bundled-CSS React).
- Pure-SSG / build-time generation of `/news` (explicitly rejected in favor of
  hybrid SSR).
- Supporting Astro 5 going forward (peer moves to `^7`; no dual-range support).
- New content types beyond articles/categories (no content-model expansion now).

## Risks / open items

- **Astro 6→7 integration-API breakage** is unknown until Phase 1 builds; it may
  be small or may require non-trivial changes. Phase 1 is effectively a spike.
- **vitest-pool-workers compatibility** with the new stack may force a version
  bump and patch changes (or the patch may become unnecessary).
- **Host Layout contract**: scaffolded pages assume the host `Layout.astro`
  accepts a title/description (web-studio convention). If a host's Layout differs,
  the user edits the scaffolded pages (they are theirs after scaffold).
- **Cloudflare deploy shift**: the host moves from static-CDN to Workers; the
  user must deploy via Wrangler. Documented, not automated beyond `init`.

## Acceptance criteria

1. Package + demo build and test green on Astro 7 / Tailwind v4 / cloudflare 14 /
   react 6 (tsc 0, vitest green, `wrangler dev` works).
2. In a web-studio host, marketing pages remain static; `/news`, `/admin`, API,
   `/cms-media` are SSR.
3. `/news` renders using the host `Layout.astro` and `@theme` tokens (no
   package public CSS); it visually belongs to the site.
4. Admin works (login, article CRUD, media upload) on the new stack.
5. `init` wires the host (adapter/react/hybrid/wrangler/D1/R2/migration/secret/
   master) and scaffolds the editable `/news` kit, verified on a real web-studio
   consumer.

## Phase 1 findings (Astro 7 migration) — done on branch feat/astro7-foundation

Resolved stack: **astro 7.0.3, @astrojs/cloudflare 14.0.1, @astrojs/react 6.0.0,
react/react-dom 19.2.7, wrangler 4.105.0.** Gates green: `tsc --noEmit` 0,
vitest 106/106, demo builds, runtime verified (login + authed API + D1 reads).

What broke and how it was resolved:

1. **`Astro.locals.runtime.env` was REMOVED in Astro v6.** It throws at runtime
   with an explicit message to use `import { env } from 'cloudflare:workers'`.
   All 14 runtime files (middleware, every API route, the `.astro` pages, the
   media proxy) were migrated to the module-scope `env` import. Types moved from
   `App.Locals.runtime.env` to a `Cloudflare.Env` augmentation in both
   `src/virtual.d.ts` and the `injectTypes` block of `integration.ts`.
   **This obsoletes the old design rule "env via `locals.runtime.env`"** — update
   the READMEs accordingly.
2. **`@astrojs/cloudflare` v14 output layout changed.** No more
   `dist/_worker.js` / `dist/_routes.json`; it now emits `dist/client/` plus
   `dist/server/{entry.mjs, wrangler.json}`. The source `wrangler.jsonc` must
   NOT set `main` (v14's `@cloudflare/vite-plugin` validates `main` at config
   time, before the build exists). Run the built worker via the generated config:
   `npx wrangler dev --config dist/server/wrangler.json --persist-to .wrangler/state`
   from `examples/demo` (`--persist-to` is required to reuse the seeded local D1;
   without it wrangler uses an empty DB next to the config and login fails).
3. **Integration API is unchanged on Astro 7.** `injectRoute` (string
   entrypoints), `addMiddleware`, the virtual-config Vite plugin, and
   `injectTypes` all work without logic changes — only the injected *type*
   content changed (point 1). No `output: 'hybrid'` was ever used.
4. **vitest-pool-workers 0.6.16 + the existing teardown patch still apply** — no
   change needed; 106 tests stayed green.
5. **Astro 7 ships a built-in CSRF origin check.** Non-browser POSTs (curl) must
   send a same-origin `Origin` header; browsers are unaffected.

Implications for later phases:

- **Phase 2 (hybrid):** v14 uses `@cloudflare/vite-plugin`, so **`astro dev` now
  serves D1/R2 via workerd** — local dev is no longer wrangler-dev-only. Confirm
  `output: 'static'` + adapter + per-route `prerender = false` behavior on
  Astro 7 from this baseline.
- **Phase 3 (`/news` scaffold):** scaffolded SSR pages must use
  `import { env } from 'cloudflare:workers'` (not `locals.runtime.env`).
- **Phase 5 (init DX):** the CLI's wrangler-config merge must NOT write `main`;
  must document/emit the `--persist-to` run command and target the generated
  `dist/server/wrangler.json`; remove the stale `platformProxy: { enabled: true }`
  from the host `astro.config.mjs` (v13 option, silently ignored by v14).
- **Docs:** README "Design rules" item on `locals.runtime.env` is now wrong;
  the deploy/run instructions need the v14 config + `--persist-to` note.

Minor (non-blocking, deferred): `SESSION_SECRET` is declared in `Cloudflare.Env`
but never read at runtime (sessions use opaque UUIDs) — pre-existing, harmless.

## Phase 2 findings (hybrid rendering) — done on branch feat/astro7-phase2-hybrid

Mechanism implemented & verified: the host keeps `output: 'static'` (default) +
the Cloudflare adapter; every injected CMS route exports `export const prerender
= false`, so admin, the admin API, `/cms-media`, and `/news` are on-demand while
the host's marketing pages prerender to static HTML **with zero host-page
changes**. Gates green (tsc 0, vitest 106).

Verified on the demo:
- `examples/demo/astro.config.mjs` is `output: 'static'` + `adapter:
  cloudflare()` (the stale v13 `platformProxy` option was dropped).
- Build split confirmed: `dist/client/index.html` exists (marketing page,
  prerendered static); there is NO `dist/client/admin` (admin is on-demand);
  `dist/server/{entry.mjs,wrangler.json}` is the worker for on-demand routes.
- Runtime (wrangler dev on the generated config): `/` 200 (static), `/admin/login`
  200, `/news` 200, login POST 303 + `nanocms_session` cookie, authed
  `/admin/api/articles` 200 — static + SSR + D1 + auth all coexist.

Implications for later phases:
- **Phase 3:** the scaffolded `/news` pages/components must also
  `export const prerender = false` (they are on-demand, reading D1 at request
  time), and they live in the host `src/` so the host Tailwind v4 scans them.
- **Phase 5 (init DX):** `init` should configure the host as `output: 'static'`
  + cloudflare adapter (NOT `output: 'server'`), and may add an integration-level
  guard that warns when no adapter is present or `output: 'server'` is set. The
  README requirement "Astro 5 with `output: 'server'`" is now wrong → it becomes
  "Astro 7, static-first (`output: 'static'`) + the Cloudflare adapter".
