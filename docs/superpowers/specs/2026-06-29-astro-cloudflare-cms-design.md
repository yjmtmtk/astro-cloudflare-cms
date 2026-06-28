# astro-cloudflare-cms 設計書

- 日付: 2026-06-29
- ステータス: 承認済み（実装計画へ移行可）
- 種別: Astro Integration（npm パッケージ）＋ CLI
- リポジトリ: 新規 `astro-cloudflare-cms`（`nanocms` の隣、まっさらな git で開始）

## 1. 目的とスコープ

### 作るもの
既存の **Astro + Cloudflare(Workers) + React** プロジェクトに、`npm install` ＋ `astro.config` の数行で **D1 + R2 製の極小CMS**（記事/カテゴリ/ユーザー/画像/公開ページ）を**後付けで差し込める Astro Integration（npm パッケージ）**。ページ群（`/admin`・`/news`・API・`/cms-media`）と認証 middleware を **`injectRoute()` / `addMiddleware()` でホストへ注入**する。

これは旧「nanocms スキル（AIがファイルをコピーする方式）」からの方針転換。配布は **npm パッケージに一本化**し、`npm update` で更新でき、オプションでカスタムできる正攻法の形にする。

### nanocms（旧）との関係
旧 `nanocms` リポジトリは **参照元（実証済みコードのソース）** としてのみ残す。新リポには旧 SKILL 化の遺物（SKILL.md / assets / コピー型スキルの構造）は**一切持ち込まない**。コア（lib / components / routes / middleware / migrations / tests）は **機能・セキュリティを現状維持したまま移植**する（XSS対策・cookie・FK・orphan GC 等そのまま）。

### 実現性（POC で確認済み）
最小の Integration ＋ ホストサイトを実機検証し、以下を確認済み：
- `injectRoute` でパッケージ内ルートをホストへ注入（200 で配信、`.astro` が描画）。
- node_modules 由来の React 島がハイドレーション（クリックで状態更新＝対話可能）。
- **パッケージ同梱のコンパイル済み CSS でスタイルが当たる**（ホストに Tailwind/shadcn 設定が無くても適用）。

### スコープ外（YAGNI）
- 多言語 i18n、コメント、公開側全文検索、リビジョン履歴、メール送信。
- `request.cf` 等を使った高度機能。デフォルトテーマ以外の凝ったテーマシステム（CSS変数の上書きのみ対応）。

## 2. リポジトリ構成（モノレポ / npm workspaces）

```
astro-cloudflare-cms/                 ← 新規 git
  package.json                        // workspaces: ["packages/*", "examples/*"]
  docs/superpowers/{specs,plans}/
  packages/
    astro-cloudflare-cms/             ← 配布する npm パッケージ
      package.json                    // name: astro-cloudflare-cms, exports, bin
      src/
        integration.ts               // export default cms(options) -> { name, hooks }
        options.ts                   // オプション型 + 既定値の解決
        routes/                      // injectRoute のエントリ群
          admin/**                   //   ページ + api(login/logout/articles/categories/users/upload)
          news/**                    //   /news, /news/[slug]
          cms-media/[...key].ts
        middleware.ts                // /admin ガード（addMiddleware で注入）
        lib/**                       // auth, db, db-articles, db-categories, db-users,
                                     //   media, media-url, render-body, sanitize-html-body,
                                     //   eyecatch, image, slug, authz, types
        components/                  // React 島（ArticleList/ArticleForm/AppSidebar/各Manager/
                                     //   RichTextEditor/EyecatchField/ImageUploader/CategorySelect/
                                     //   AdminShell）＋ 同梱 ui/(shadcn) ＋ hooks/use-mobile
        layouts/AdminLayout.astro
        styles/                      // input.css（Tailwind 指示）→ build で styles.css 生成
      styles.css                     // 生成された同梱 CSS（配布物）
      migrations/0001_init.sql
      bin/cli.mjs                    // `astro-cloudflare-cms` CLI（init 等）
      tailwind.config.mjs            // content: パッケージ自身のファイルのみ
      vitest.config.ts
      test/**                        // 実 D1 + R2 の vitest（移植）
      patches/                       // vitest-pool-workers WAL パッチ（必要なら）
  examples/demo/                     ← デモ＆E2E土台（Astro + Cloudflare）
    package.json                     // astro-cloudflare-cms を file: で導入
    astro.config.mjs                 // integrations: [react(), cms()]
    wrangler.jsonc                   // D1/R2 binding（ローカル）
    src/pages/index.astro            // ホスト独自トップ
```

- パッケージマネージャは **npm workspaces**（pnpm 不要）。
- `examples/demo` は「2行で導入して動く」ことの実証＋手動 E2E の土台。`file:../../packages/astro-cloudflare-cms` で参照。

## 3. パッケージ公開 API（ホスト導入体験）

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import cms from 'astro-cloudflare-cms';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({ platformProxy: { enabled: true } }),
  integrations: [
    react(),
    cms({
      adminBasePath: '/admin',          // 既定 '/admin'
      newsBasePath: '/news',            // 既定 '/news'
      mediaBasePath: '/cms-media',      // 既定 '/cms-media'
      brand: 'astro-cloudflare-cms',    // 管理画面のブランド表記
      // defaultEyecatchUrl は env DEFAULT_EYECATCH_URL でも可
    }),
  ],
});
```

### Integration が行うこと（hooks）
- **`astro:config:setup`**:
  - `injectRoute({ pattern, entrypoint })` を **オプションのパス接頭辞から動的生成**して admin/news/api/cms-media の全ルートを注入。entrypoint はパッケージ内ファイル（`astro-cloudflare-cms/routes/...`）。
  - `addMiddleware({ entrypoint: 'astro-cloudflare-cms/middleware', order: 'pre' })` で `/admin` ガードを注入。
  - 同梱 `styles.css` の適用（各注入ルートが import する方式を基本とし、必要なら `injectScript` も検討）。
  - ホスト設定の検証：`output: 'server'`／`@astrojs/cloudflare` アダプタ／`@astrojs/react` の有無を確認し、不足は `updateConfig` で補完 or `logger.warn` で明示。
  - オプションを**仮想モジュール**（`virtual:astro-cloudflare-cms/config`）でルート側へ受け渡し（パス接頭辞やブランドをルートが参照）。
- **`astro:config:done` / `injectTypes`**:
  - `App.Locals`（`user: SessionUser | null`、`runtime.env`）と CMS 設定の型をホストへ提供。
- **バインディング固定**: D1 = `DB`、R2 = `MEDIA`。env = `PUBLIC_R2_BASE_URL` / `DEFAULT_EYECATCH_URL` / `SESSION_SECRET`。

### 設計上の制約
- Integration は **Cloudflare 資源の作成・wrangler 設定の追記・マイグレーション適用までは行えない**（Astro のビルド範囲外）。これらは **CLI（第5節）** が担当。Integration は「コード注入＋設定検証＋型提供」に専念。

## 4. スタイル（同梱コンパイル済み CSS / POC 実証済み）

- パッケージ内で **Tailwind をパッケージ自身のコンポーネントに対してビルド**し、`styles.css` を**同梱**。注入ルートがそれを import する。
- 結果、**ホストは Tailwind も shadcn 設定も不要**（旧スキルの「shadcn init＋トークン写経」要求を撤廃）。
- テーマの CSS 変数（`--background` / `--sidebar-*` 等）も同梱 CSS に含める。ホストは CSS 変数を上書きすればテーマ調整可能（任意）。
- shadcn `ui/` プリミティブと `hooks/use-mobile` は**パッケージに同梱**（旧方式の「`npx shadcn add`」は不要に）。
- ビルド: `tailwindcss -c tailwind.config.mjs -i src/styles/input.css -o styles.css --minify` をパッケージの build スクリプトに含める。

## 5. CLI（`astro-cloudflare-cms`）— Cloudflare インフラ半自動

Integration では自動化できない CF 操作を CLI が担当。すべて `npx wrangler` 経由・冪等・再実行可。

```
npx astro-cloudflare-cms init
```
1. `npx wrangler d1 create <db>` / `npx wrangler r2 bucket create <bucket>` を実行。
2. ホストの wrangler 設定に **`DB`/`MEDIA` binding** と vars（`PUBLIC_R2_BASE_URL`/`DEFAULT_EYECATCH_URL`）、`compatibility_date: 2025-09-01`、`nodejs_compat` を追記（既存があればマージ・確認）。
3. パッケージ同梱の `migrations/0001_init.sql` をホストの `migrations/` に配置し、**`npx wrangler d1 migrations apply <db> --local`（および `--remote`）** をトラッキング付きで適用。
4. `.dev.vars` に `SESSION_SECRET` を生成し、本番は `npx wrangler secret put SESSION_SECRET` を案内。
5. **マスターユーザー作成**（PBKDF2 ハッシュ生成 → `npx wrangler d1 execute` で投入）。
- 失敗時は明確なエラーと次の手を提示。`init` は段階を検出して途中から再開できる設計。
- 将来サブコマンド（`create-user` 等）は追加余地を残す（初期は `init` のみで可）。

## 6. デモ & テスト

- **`examples/demo/`**: パッケージを `file:` で入れた最小 Astro + Cloudflare サイト。ローカル D1/R2、`npm run build && npx wrangler dev` で起動。「導入が数行で動く」ことの実証＋手動 E2E（ログイン→記事作成→画像→/news→未来日付非表示→プレビュー→削除でメディア掃除）。R2 書き込み（画像)は `wrangler dev` 必須（astro dev の platformProxy 制約）を docs に明記。
- **`packages/astro-cloudflare-cms/test/`**: 移植した vitest（実 D1 + R2 / workers pool）。認証・セッション・可視性・サニタイズ（XSS PoC 回帰）・スラッグ・メディア reconcile/cascade/24h GC・eyecatch・authz を網羅。`@cloudflare/vitest-pool-workers` の WAL teardown バグは patch-package 移植 or 依存 bump で対処。型チェックゲート `astro check`（または `tsc`）を 0 エラーに保つ。

## 7. nanocms からの移植方針

| 区分 | 方針 |
|---|---|
| `lib/**`（auth, db-*, media, sanitize, render-body, eyecatch, slug, authz, image, types） | **ほぼそのまま移植**。import 経路のみ調整。 |
| `components/**`・`layouts/`・`ui/`・`hooks/` | **そのまま移植**（同梱）。ブランド/パス接頭辞は仮想モジュール経由で受け取るよう微修正。 |
| `src/pages/**`（自動ルート） | **`routes/**` に再配置**し、Integration の `injectRoute` エントリにする。`Astro.locals` 利用は不変。 |
| `middleware.ts` | 移植し **`addMiddleware` で注入**。保護パス判定はオプションの `adminBasePath` を参照するよう一般化。 |
| `migrations/0001_init.sql` | そのまま同梱。 |
| `test/**` | そのまま移植（実 D1+R2）。 |
| パス接頭辞 | 固定 `/admin` 等 → **オプション化**（既定値は同じ）。ルート/middleware/リンク生成が接頭辞を参照。 |
| スタイル | host 依存（shadcn init）→ **同梱 styles.css** に変更。 |
| 認証 cookie / Secure 条件付き / FK 事実 / orphan GC / 可視性ルール | **不変**（実証済みの挙動を維持）。 |

## 8. 受け入れ基準（このプロジェクトの完成条件）

- `examples/demo` で、`astro.config` に `cms()` を足し `npx astro-cloudflare-cms init` を実行するだけで、`npx wrangler dev` 上で以下が動く：
  - マスターログイン → 記事作成（カテゴリ・公開日時・本文画像・アイキャッチ）→ 公開。
  - 未来日時の記事が `/news` に未ログインで表示されない／ログイン中はプレビュー（バナー）表示。
  - 画像がクライアント側で 1280px 内接・webp 化されて R2 に保存され、`/cms-media` で表示。記事削除・差し替えで R2 が掃除される（迷子なし）。
  - 公開本文がサニタイズされて描画（`<script>`/イベントハンドラ/属性ブレイクアウト/コメント除去）。
  - author ロールが他人の記事を編集できない。
- ホストは **Tailwind/shadcn の追加設定なし**で正しくスタイルが当たる（同梱CSS）。
- ルート接頭辞をオプションで変更できる（例 `/news` → `/blog`）。
- パッケージの vitest が全て green、型チェック 0 エラー。
- パッケージは自己完結（絶対パス非依存）で、`examples/demo` から `file:` 導入で動作。将来 `npm publish` 可能な構造。

## 9. 段階実装の方針（writing-plans で詳細化）

おおまかな順序（各段階で動く・テストできる単位）：
1. **モノレポ雛形＋空Integration＋デモ**：workspaces、空の `cms()`、`examples/demo` が起動。
2. **コア移植（lib＋migrations＋tests）**：nanocms の lib とテストを移植し vitest green。
3. **ルート注入＋middleware＋型**：`injectRoute`/`addMiddleware`/`injectTypes`、パス接頭辞オプション、仮想モジュール。
4. **UI＋同梱CSSビルド**：components/layouts/ui を移植、Tailwind ビルドで `styles.css` 同梱、デモで描画/ハイドレーション確認。
5. **CLI（init）**：D1/R2 作成・binding・migration・master 作成。
6. **デモ E2E＋仕上げ**：受け入れ基準を `wrangler dev` で実機確認、README/docs。
