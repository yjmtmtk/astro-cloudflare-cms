# astro-cloudflare-cms — 開発引き継ぎ / Project Memory

> このファイルは Claude Code が新セッションで自動読み込みします。**開発を再開する人／エージェントが最初に読む前提**で書いています。ユーザー向けの導入手順・オプションは [`packages/astro-cloudflare-cms/README.md`](./packages/astro-cloudflare-cms/README.md) を参照。

## これは何 / 現状

既存の **Astro + Cloudflare Workers + React** サイトに、`astro.config` へ `cms()` を足すだけで **D1+R2 製の小型CMS**（管理UI・公開 `/news`・自前認証・画像パイプライン）を注入する **Astro Integration（npm パッケージ）+ CLI**。

**ステータス: 全6ステージ完了 + 管理画面UX刷新済み。** vitest 90 green / `tsc --noEmit` 0 errors。受け入れ基準（design spec §8）はブラウザ実機で全項目検証済み。構造は `npm publish` 可能だが**まだ publish も git push もしていない**（リモート未設定。**作業は `master` ブランチ上**で進行＝過去の「main にマージ済み」表記は履歴上のもので、現行ラインは master）。

**管理画面UX刷新（2026-06-29, commit `43ea3e7`）:** リッチエディタ刷新（typography 反映・focus-within リング・ツール15種・アクティブ状態）／管理3一覧（記事・カテゴリ・ユーザー）テーブルの統一（compact + ghost アイコン + role badge）／記事フォーム2カラム化（本文 + 右「公開設定」サイドバー）／**server-side ページャー**／公開記事→`/news`・管理サイドバー→公開サイトの導線追加。規約は後述『管理画面UX / ページング規約』。

## 開発の始め方（コマンド）

```bash
npm install                                   # ワークスペース全体
npm test                                      # パッケージのテスト（vitest + cloudflare pool, 90件）
npm run build:demo                            # demo をビルド（= build -w examples/demo）
npm run build:css -w astro-cloudflare-cms     # コンポーネント変更後に styles.css を再生成
cd packages/astro-cloudflare-cms && npx tsc --noEmit -p tsconfig.json   # 型チェック
```

### ローカル動作確認（demo, wrangler dev 必須）
画像アップロード／メディアGCは **R2 書き込みが必要 → `npx wrangler dev` 必須**（`astro dev` の platformProxy は R2 に書けない）。

```bash
npm run build -w examples/demo
cd examples/demo && npx wrangler dev           # /admin/login を開く
```
- demo のローカル D1/R2 は `examples/demo/.wrangler/` に既にあり、**master = `admin@example.com` / `admin1234`** が投入済み。
- 作り直したいとき: `cd examples/demo && npx astro-cloudflare-cms init --local --yes --master-email a@b.c --master-password xxxxxxxx`
- **パッケージの source を変えた後に demo を再ビルドしても古いバンドルがキャッシュされることがある。** コンポーネント等を直したら `rm -rf examples/demo/{dist,.astro,node_modules/.vite}` してから再ビルド。

## リポジトリ構成

```
packages/astro-cloudflare-cms/   公開する npm パッケージ本体
  src/integration.ts             cms() 本体（injectRoute / addMiddleware / virtual config plugin / injectTypes）
  src/options.ts                 オプション正規化（adminBasePath/newsBasePath/brand/defaultEyecatchUrl）
  src/middleware.ts              /admin/* ガード（config.adminBasePath で判定）
  src/routes/**                  注入されるルート（admin API・page・/cms-media）
  src/components/**              React アイランド（shadcn ui/ + 合成コンポーネント）
                                 RichTextEditor(Tiptap)/ArticleForm/ArticleList/CategoryManager/UserManager/Pager/AppSidebar
  src/lib/**                     コアロジック（auth/db*/media/sanitize/image/pagination 等）
  src/cli/**, bin/cli.mjs        `astro-cloudflare-cms init` CLI
  migrations/0001_init.sql       D1 スキーマ（同梱）
  styles.css                     Tailwind ビルド成果物（コミット済み・同梱）
  test/**                        vitest（lib 単体 + cli 単体）
examples/demo/                   導入実証 + 手動E2E用のホスト
docs/superpowers/
  specs/2026-06-29-...-design.md 設計書（受け入れ基準は §8）
  plans/...-plan-1..6-*.md       段階実装プラン（移植元・transform ルールの一次情報）
```

## 設計上の不可侵ルール（壊さないために必読）

1. **ランタイムファイルは相対 import のみ。`@/` エイリアス禁止。**
   パッケージは **TS ソースのまま配布**され、ホストの Astro/Vite ビルドでコンパイルされる。`@/` はホストの `src` に解決されてしまうため使えない。`routes/`・`components/`・`middleware.ts`・`lib/` 内はすべて相対パス（例: `../../../lib/auth`）。`@/` が使えるのは **テストだけ**（vitest の `resolve.alias`）。

2. **パス接頭辞は `virtual:acc-config` から取る。`/admin`・`/news` をハードコードしない。**
   `integration.ts` の Vite プラグインが解決済みオプションを `virtual:acc-config` として注入。ルート/コンポーネント/middleware は `import { config } from 'virtual:acc-config'` して `config.adminBasePath` / `config.newsBasePath` / `config.brand` から URL を組む。**`/cms-media` だけは固定**（内部用、設定不可）。

3. **管理シェルは `client:only="react"`（AdminLayout.astro）。`client:load` に戻さない。**
   これは React #418 ハイドレーション不一致の修正。原因は「`client:load` の AdminShell に Astro 名前付きスロット（actions）を渡す」構造で、actions スロットの無いページ（new 等）で SSR が空 `<astro-slot>` を出すのに client が何も描かず不一致になる。`client:only` で管理シェルの SSR 自体を無くして解消（認証必須の管理画面なので SSR 不要）。**`/news` 等の公開ページは SSR 維持（SEO）**。

4. **CSS は同梱ビルド方式。** Tailwind はパッケージ自身のコンポーネントに対してビルド → `styles.css`（コミット済み）。ページルートが相対 import。**コンポーネント/ページの class を変えたら `npm run build:css -w astro-cloudflare-cms` を実行してコミット。** ホスト側に Tailwind/shadcn 設定は不要（`tailwind.config.mjs` の color map に `sidebar`/`popover`/`card` を必ず含める＝透過バグ防止）。
   - **`@tailwindcss/typography` を使用**（build 専用の devDep。styles.css 同梱なのでホストには不要）。`prose` クラスが **エディタ本文と公開記事 `/news/[slug]`（`<article class="prose">`）の両方**の H2/リスト/引用を担う。**外すと見出し等が素のテキストに戻る。**
   - **`.ProseMirror` 向けの素の CSS は `src/styles/input.css` の `@layer` の外に置く**こと。`ProseMirror` クラスは Tiptap が実行時付与しソースに出現しないため、`@layer` 内だと Tailwind の content スキャンで tree-shake され消える。

5. **CLI のハッシュは `src/lib/auth.ts` と byte 一致を維持。**
   `src/cli/crypto.mjs` の `hashPassword` は PBKDF2/SHA-256/100,000/16Bsalt/32Bkey/base64（WebCrypto）で auth.ts と完全一致。`test/cli-crypto.test.ts` が両者の一致を assert している。認証ハッシュを変えるなら両方＋テストを更新。

6. **固定バインディング/env。** D1=`DB`、R2=`MEDIA`。env は `SESSION_SECRET`/`PUBLIC_R2_BASE_URL`/`DEFAULT_EYECATCH_URL`、すべて `locals.runtime.env` 経由。`App.Locals`（`user` / `runtime.env`）は `injectTypes`（`astro:config:done`）でホストに供給。compat: `compatibility_date >= 2025-09-01` + `nodejs_compat`。

7. **`media` テーブルは articles への FK を持たない**（アップロードが記事行より先に起きるため意図的）。削除は DB→R2 の順。孤児は reconcile(300s grace)/cascade/24h GC で掃除。

## 管理画面UX / ページング規約（2026-06-29 追加）

- **リッチエディタ（`RichTextEditor.tsx`）**: 追加 tiptap 依存は無し。**StarterKit v3 が link/underline/undoRedo まで内包**するので、Image 拡張だけ別途。heading は `levels: [2,3]` に制限（公開サニタイザが h1–h3 のみ許可）。ツールのアクティブ状態は `useEditorState`（`editor` が null でも `e?.isActive(...)` でクラッシュしない）。
- **サニタイザ（`sanitize-html-body.ts`）の許可タグはエディタ出力と一致させる。** 区切線 `hr` を許可済み。新ツールでタグが増えたら `ALLOWED_TAGS`（必要なら `ALLOWED_ATTRS`）に追加し、`test/sanitize.test.ts` に保持テストを足す。
- **server-side ページング（`lib/pagination.ts` の `parsePage`）**: 管理一覧 API（articles/categories/users）の GET は **`?page=` がある時だけ** envelope `{ items, total, page, pageSize }` を返す。**`page` 無しは従来どおり素の配列**（カテゴリ等のドロップダウンがこの全件返却に依存）。この二形の後方互換を壊さないこと。
  - DB 層: `listArticles` は `ArticleFilter.limit/offset`、`listCategories`/`listUsers` は `{ limit, offset }` を受ける。件数は `countArticles`（filter 同期）/`countCategories`/`countUsers`。SQLite の都合で **OFFSET は LIMIT があるときだけ**付与。
  - フロント: 共通 `Pager.tsx`（1ページ20件）。ArticleList はフィルタ変更時に `setPage(1)`。
- **導線**: 公開記事 `/news/[slug]` に「← News一覧へ」、管理サイドバー（`AppSidebar.tsx`）フッターに「公開サイト」（`config.newsBasePath` を新規タブ）。いずれもパスは `virtual:acc-config` 由来。

## テスト基盤の注意

- vitest + `@cloudflare/vitest-pool-workers`（miniflare で D1/R2 をインメモリ提供）。
- **`patches/@cloudflare+vitest-pool-workers+0.6.16.patch`** が teardown のバグを修正。`postinstall: patch-package` は **ルート** package.json にある（このdepはルート node_modules にホイストされるため）。
- テストの miniflare compat date は `2025-02-04`（miniflare の上限）。本番ランタイムの `2025-09-01` とは別物。
- CLI の crypto/config テストもこの workers pool 上で走る。

## Git / 運用

- **Git identity（重要）: `yjmtmtk <tomotaka.yajima@gmail.com>`**。リポジトリにこの設定済み。`tefista.dev@gmail.com` は使わない。普通に `git commit` すればよい（`-c` で上書きしない）。コミット本文末尾に Claude の `Co-Authored-By` を付けてよい。
- まだ **リモート未設定・未 push**。**作業ブランチは `master`**（全履歴がここ）。GitHub に上げるなら remote 追加 → `master` を push（必要なら `main` へ改名/整理）。
- `.superpowers/sdd/`（SDD の進捗 ledger）は gitignore 済みの作業用。

## 既知の制約 / 落とし穴

- 管理画面は client:only なので初回に一瞬ブランク（JS で描画）。認証必須UIなので許容。
- CLI が wrangler.jsonc をマージすると **コメントは落ちる**（jsonc→JSON 再シリアライズ）。
- CLI の **remote 経路（実 Cloudflare アカウントでの `d1 create` / `secret put` / `--remote`）は未通し**。検証済みなのは `--local` 経路のみ。
- toml の wrangler 設定は CLI が自動編集しない（手動編集を案内）。

## 次にやる候補（未了）

1. 実 Cloudflare アカウントで `npx astro-cloudflare-cms init`（remote 経路）を通しで確認。
2. `npm publish`（version は `0.1.0`、構造は publish 可能）。GitHub remote 追加 & push。
3. author ロール運用向け CLI サブコマンド（`create-user` 等）。
4. demo の自動 E2E（現状は手動ブラウザ検証）。

---

## 移植元（参考）

lib・コンポーネントは隣の **nanocms playground**（このリポジトリの兄弟ディレクトリ `../nanocms/playground`、当時の実証済み実装）から移植（多くは verbatim ＋ 上記 transform 1–2）。移植の対応関係と transform ルールは `docs/superpowers/plans/*` に一次情報がある。nanocms 側を開かなくても、本リポジトリと plans だけで開発を続けられる。
