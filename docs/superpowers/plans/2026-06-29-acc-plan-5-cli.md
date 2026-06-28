# astro-cloudflare-cms — Plan 5: CLI (`init`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Ship `npx astro-cloudflare-cms init` — the half-automated Cloudflare setup that the Integration can't do at build time: create/detect D1 + R2, merge the host's wrangler config (DB/MEDIA bindings, vars, compat), copy + apply the migration, generate `SESSION_SECRET`, and seed the master user — idempotent, resumable, with a fully-local path that needs no Cloudflare account.

**Architecture:** A dependency-free Node ESM CLI at `bin/cli.mjs` (runs via `npx`), built from small pure modules (`src/cli/*.mjs`): a crypto module whose `hashPassword` is byte-identical to `src/lib/auth.ts` (global WebCrypto — PBKDF2/SHA-256/100k/16B salt/32B key/base64, so a CLI-seeded master authenticates through the package's `login()`), a wrangler-config merger (idempotent jsonc edit), and an orchestrator that shells out to `npx wrangler`. Account-touching steps (`d1 create`, `r2 bucket create`, `secret put`, `--remote`) are skipped under `--local`/when unauthenticated and printed as guidance; the local path (config merge + `migrations apply --local` + master seed `--local`) is fully runnable and is what the demo + tests exercise.

**Tech Stack:** Node ≥18 (global `crypto.subtle`, `btoa`/`atob`, `node:fs`, `node:child_process`, `node:readline`). No runtime deps. Vitest (node env) for the pure-module unit tests.

## Global Constraints

- **Hash parity is mandatory:** the CLI's `hashPassword` MUST match `src/lib/auth.ts` exactly — `ITERATIONS=100_000`, `KEY_BYTES=32`, `SALT_BYTES=16`, PBKDF2 SHA-256, `hash=base64(32 derived bytes)`, `salt=base64(16 salt bytes)`, via `crypto.subtle` + `btoa`. A master seeded by the CLI must verify through the package's `login()`.
- **Users insert columns:** `INSERT INTO users (id,email,password_hash,password_salt,role,name,created_at)` with `role='master'`, `created_at=unix seconds`, `id=crypto.randomUUID()`.
- **Fixed bindings/vars:** D1 binding `DB`, R2 binding `MEDIA`; vars `PUBLIC_R2_BASE_URL`, `DEFAULT_EYECATCH_URL`; `compatibility_date: "2025-09-01"`; `compatibility_flags: ["nodejs_compat"]`.
- **`npx wrangler` only** (never a global/installed wrangler). All wrangler calls go through `npx wrangler ...`.
- **Idempotent & resumable:** every step detects "already done" and skips; re-running `init` is safe. Failures print a clear message + the next manual step.
- **No interactive-only paths in tests:** support `--master-email`/`--master-password`/`--db-name`/`--bucket-name`/`--local`/`--yes` flags (and `ACC_MASTER_EMAIL`/`ACC_MASTER_PASSWORD` env fallback) so `init` runs non-interactively.
- **Commits:** plain `git commit` (repo identity `yjmtmtk <tomotaka.yajima@gmail.com>`; no `-c`); body ends with the Claude `Co-Authored-By` trailer.

---

## File Structure (Plan 5 scope, under `packages/astro-cloudflare-cms/`)

- Modify: `package.json` (`"bin": { "astro-cloudflare-cms": "./bin/cli.mjs" }`, `files` includes `bin/`, `migrations/`)
- Create: `bin/cli.mjs` (entry — arg parse + dispatch to orchestrator)
- Create: `src/cli/crypto.mjs` (`hashPassword`, `genSessionSecret`)
- Create: `src/cli/wrangler-config.mjs` (`mergeWranglerConfig`, `findWranglerConfig`)
- Create: `src/cli/init.mjs` (the `init` orchestrator — step sequence + idempotency + logging)
- Create: `src/cli/util.mjs` (`run` shell helper, `log`/`warn`/`die`, `prompt`)
- Create: `test/cli-crypto.test.ts`, `test/cli-wrangler-config.test.ts`

---

### Task 1: CLI scaffold + crypto module (hash parity)

**Files:** modify `package.json`; create `bin/cli.mjs`, `src/cli/crypto.mjs`, `src/cli/util.mjs`, `test/cli-crypto.test.ts`.

**Interfaces:**
- Produces: `hashPassword(password, saltB64?) → Promise<{hash, salt}>` and `genSessionSecret() → string` (32 random bytes, base64) in `src/cli/crypto.mjs`; `run(cmd, args, opts)`, `log/warn/die`, `prompt(question)` in `src/cli/util.mjs`; `bin/cli.mjs` parses argv and dispatches (`init`, `--help`, `--version`).

- [ ] **Step 1: Write the failing test** `test/cli-crypto.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { hashPassword, genSessionSecret } from '../src/cli/crypto.mjs';
import { hashPassword as libHash } from '@/lib/auth';

describe('cli crypto', () => {
  it('produces 32-byte(base64=44) hash and 16-byte(base64=24) salt', async () => {
    const { hash, salt } = await hashPassword('pw');
    expect(hash).toHaveLength(44);
    expect(salt).toHaveLength(24);
  });
  it('is deterministic given the same salt', async () => {
    const a = await hashPassword('pw');
    const b = await hashPassword('pw', a.salt);
    expect(b.hash).toBe(a.hash);
  });
  it('matches the package auth.ts hash byte-for-byte (login parity)', async () => {
    const salt = (await hashPassword('secret')).salt;
    const cli = await hashPassword('secret', salt);
    const lib = await libHash('secret', salt);
    expect(cli.hash).toBe(lib.hash);
  });
  it('genSessionSecret returns 32 random bytes as base64 (44 chars), unique', () => {
    const a = genSessionSecret(), b = genSessionSecret();
    expect(a).toHaveLength(44);
    expect(a).not.toBe(b);
  });
});
```
- [ ] **Step 2: Run it, expect fail** (`src/cli/crypto.mjs` missing). `npm run test -w astro-cloudflare-cms -- cli-crypto`.
- [ ] **Step 3: Implement `src/cli/crypto.mjs`** — replicate `auth.ts` exactly with WebCrypto:
```js
const ITERATIONS = 100_000, KEY_BYTES = 32, SALT_BYTES = 16;
const enc = new TextEncoder();
function bytesToBase64(bytes) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); }
function base64ToBytes(b64) { const bin = atob(b64); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
export async function hashPassword(password, saltB64) {
  const salt = saltB64 ? base64ToBytes(saltB64) : crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const km = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, km, KEY_BYTES * 8);
  return { hash: bytesToBase64(new Uint8Array(bits)), salt: bytesToBase64(salt) };
}
export function genSessionSecret() { return bytesToBase64(crypto.getRandomValues(new Uint8Array(32))); }
```
- [ ] **Step 4: Implement `src/cli/util.mjs`** — `run(cmd, args, {cwd, capture})` wrapping `node:child_process.spawnSync` (`stdio: capture ? 'pipe' : 'inherit'`, returns `{status, stdout}`); `log`/`warn`/`die(msg)` (die → `console.error` + `process.exit(1)`); `prompt(q)` via `node:readline` (returns trimmed answer; for password, no echo not required).
- [ ] **Step 5: Implement `bin/cli.mjs`** — shebang `#!/usr/bin/env node`; parse `argv` into `{ _: [cmd], flags }` (support `--key value` and `--flag`); `--help`/`-h` prints usage; `--version` prints package version (read `../package.json`); `init` → `import('../src/cli/init.mjs').then(m => m.init(flags))`; unknown → usage + exit 1. (`init.mjs` lands in Task 3; for now a temporary `init.mjs` that throws "not implemented" is fine, OR guard so Task 1's `bin` only wires `--help`/`--version` and `init` is added in Task 3 — keep `bin/cli.mjs` referencing `init.mjs` and create a stub `src/cli/init.mjs` exporting `init` that `die`s "run after Task 3" so the file resolves.) Set `package.json` `"bin"`, and add `bin/`, `migrations/`, `styles.css`, `src` to `files`.
- [ ] **Step 6: Run tests, expect pass.** `npm run test -w astro-cloudflare-cms -- cli-crypto` → 4 pass. Then `node bin/cli.mjs --help` prints usage; `node bin/cli.mjs --version` prints the version.
- [ ] **Step 7: Commit** `feat(cli): scaffold + crypto module with auth.ts hash parity`

---

### Task 2: wrangler config merger (idempotent)

**Files:** create `src/cli/wrangler-config.mjs`, `test/cli-wrangler-config.test.ts`.

**Interfaces:**
- Produces: `findWranglerConfig(dir) → {path, format} | null` (looks for `wrangler.jsonc`/`wrangler.json`/`wrangler.toml`); `mergeWranglerConfig(text, format, {dbName, dbId, bucketName}) → {text, changed}` — returns the updated config text adding DB/MEDIA bindings, vars, compat date + nodejs_compat flag; idempotent (re-merge → `changed:false`, no dup entries). For Plan 5, support `jsonc`/`json` fully (the demo + most hosts use it); for `toml`, detect and emit a clear "edit manually, here are the lines" message rather than parsing (documented limitation).

- [ ] **Step 1: Write the failing test** `test/cli-wrangler-config.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { mergeWranglerConfig } from '../src/cli/wrangler-config.mjs';

const base = `{
  "name": "demo",
  "compatibility_date": "2024-01-01"
}`;

describe('mergeWranglerConfig (jsonc)', () => {
  it('adds DB + MEDIA bindings, vars, compat date + nodejs_compat', () => {
    const { text, changed } = mergeWranglerConfig(base, 'jsonc', { dbName: 'acc_db', dbId: 'xxx', bucketName: 'acc_media' });
    expect(changed).toBe(true);
    const cfg = JSON.parse(text);
    expect(cfg.d1_databases).toEqual([{ binding: 'DB', database_name: 'acc_db', database_id: 'xxx' }]);
    expect(cfg.r2_buckets).toEqual([{ binding: 'MEDIA', bucket_name: 'acc_media' }]);
    expect(cfg.compatibility_date).toBe('2025-09-01');
    expect(cfg.compatibility_flags).toContain('nodejs_compat');
    expect(cfg.vars).toMatchObject({ PUBLIC_R2_BASE_URL: '', DEFAULT_EYECATCH_URL: '' });
  });
  it('is idempotent — second merge makes no change', () => {
    const first = mergeWranglerConfig(base, 'jsonc', { dbName: 'acc_db', dbId: 'xxx', bucketName: 'acc_media' });
    const second = mergeWranglerConfig(first.text, 'jsonc', { dbName: 'acc_db', dbId: 'xxx', bucketName: 'acc_media' });
    expect(second.changed).toBe(false);
    expect(second.text).toBe(first.text);
  });
  it('does not clobber an existing nodejs_compat flag or other d1 bindings', () => {
    const withFlag = `{ "name": "d", "compatibility_flags": ["nodejs_compat"], "d1_databases": [{ "binding": "OTHER", "database_name": "o", "database_id": "1" }] }`;
    const { text } = mergeWranglerConfig(withFlag, 'jsonc', { dbName: 'acc_db', dbId: 'xxx', bucketName: 'acc_media' });
    const cfg = JSON.parse(text);
    expect(cfg.compatibility_flags.filter((f) => f === 'nodejs_compat')).toHaveLength(1);
    expect(cfg.d1_databases.map((d) => d.binding).sort()).toEqual(['DB', 'OTHER']);
  });
});
```
- [ ] **Step 2: Run it, expect fail.**
- [ ] **Step 3: Implement `src/cli/wrangler-config.mjs`.** Parse jsonc by stripping `//` and `/* */` comments then `JSON.parse` (note: for write-back, re-serialize with `JSON.stringify(cfg, null, 2)` — accept that comments are dropped on change; warn the user). Merge logic: ensure `d1_databases` contains a `binding:'DB'` entry (replace if exists, add if not); ensure `r2_buckets` contains `binding:'MEDIA'`; set `compatibility_date='2025-09-01'` only if older/absent; ensure `compatibility_flags` includes `'nodejs_compat'` (dedup); ensure `vars` has the two keys (don't overwrite non-empty existing values). Track whether anything changed → `changed`. `findWranglerConfig` checks the three filenames in `dir`.
- [ ] **Step 4: Run tests, expect pass** (3 pass).
- [ ] **Step 5: Commit** `feat(cli): idempotent wrangler config merge`

---

### Task 3: `init` orchestrator

**Files:** replace stub `src/cli/init.mjs`.

**Interfaces:**
- Consumes: `hashPassword`/`genSessionSecret` (crypto.mjs), `mergeWranglerConfig`/`findWranglerConfig` (wrangler-config.mjs), `run`/`log`/`warn`/`die`/`prompt` (util.mjs).
- Produces: `init(flags) → Promise<void>` — runs the ordered, idempotent setup in `process.cwd()` (the host project).

- [ ] **Step 1: Implement `init(flags)`** with these ordered steps, each logged and idempotent:
  1. **Resolve options:** `dbName = flags['db-name'] ?? '<dirname>_db'`, `bucketName = flags['bucket-name'] ?? '<dirname>_media'`, `local = !!flags.local`, master email/pw from flags/env/prompt.
  2. **D1:** if `local`, use `database_id: 'local-placeholder'` (no account call); else `run('npx', ['wrangler','d1','create',dbName], {capture:true})`, parse the printed `database_id` (on "already exists", `run npx wrangler d1 list` capture and extract the id). On auth failure, `warn` + fall back to local placeholder + continue.
  3. **R2:** if not `local`, `npx wrangler r2 bucket create <bucketName>` (ignore "already exists"). Local: skip (miniflare auto-provisions).
  4. **wrangler config:** `findWranglerConfig(cwd)`; if none, `die` with guidance. Else `mergeWranglerConfig`; if `changed`, write back (warn if comments dropped); log what was added.
  5. **migrations:** ensure `cwd/migrations/` exists; copy the package's `migrations/0001_init.sql` (resolve via `new URL('../../migrations/0001_init.sql', import.meta.url)`) if not already present; `run('npx',['wrangler','d1','migrations','apply',dbName, local?'--local':'--remote'])`.
  6. **SESSION_SECRET:** if `cwd/.dev.vars` lacks `SESSION_SECRET`, append `SESSION_SECRET=<genSessionSecret()>`; log. Print the prod guidance: `npx wrangler secret put SESSION_SECRET`.
  7. **master user:** check existence — `run('npx',['wrangler','d1','execute',dbName, local?'--local':'--remote','--json','--command',"SELECT COUNT(*) c FROM users WHERE role='master'"], {capture:true})`; if a master exists, log "master exists, skipping". Else hash the password, build the INSERT (escape single quotes in email/name), `wrangler d1 execute ... --command "<INSERT>"`. Log success.
  8. **Done:** print next steps (`npm run build && npx wrangler dev`, log in at `${adminBasePath}/login`).
  Wrap each step so a failure prints a clear message + how to resume; never leave a half-written config without saying so.
- [ ] **Step 2: Manual smoke** — `node bin/cli.mjs init --help` (usage), and `node bin/cli.mjs init --local --yes --db-name acc_demo_db --master-email a@b.c --master-password pw123456` in a TEMP copy dir (see Task 4) — but the full run is verified in Task 4. Here just confirm `init` is wired (no "not implemented").
- [ ] **Step 3: Commit** `feat(cli): init orchestrator (D1/R2/config/migrate/secret/master, idempotent local path)`

---

### Task 4: Integration verify — local `init` end-to-end

**Files:** none (verification; operates in a temp dir).

- [ ] **Step 1: Build a throwaway host dir** under the scratchpad: a minimal `wrangler.jsonc` (`{ "name": "acctmp", "compatibility_date": "2024-01-01" }`) and an empty `migrations/` is NOT pre-made (the CLI copies it). Copy is fine; do NOT touch the real demo's config.
- [ ] **Step 2: Run the CLI locally, non-interactively:**
```bash
cd <tmp-host>
node <pkg>/bin/cli.mjs init --local --yes --db-name acc_tmp_db \
  --master-email master@example.com --master-password test12345
```
  Expect: wrangler.jsonc gains DB(+local-placeholder id)/MEDIA bindings, vars, compat 2025-09-01, nodejs_compat; `migrations/0001_init.sql` copied; `migrations apply --local` runs; `.dev.vars` gets `SESSION_SECRET`; master inserted. Capture the output.
- [ ] **Step 3: Assert results:**
  - `JSON.parse`(stripped wrangler.jsonc) has the DB + MEDIA bindings + nodejs_compat + vars (grep/node check).
  - `npx wrangler d1 execute acc_tmp_db --local --command "SELECT email,role FROM users"` → shows `master@example.com | master`.
  - **Hash round-trip (gold):** read back `password_hash,password_salt` for the master (`--json`), then in node: `import('<pkg>/src/cli/crypto.mjs')`, `hashPassword('test12345', storedSalt)` and assert `.hash === storedHash`. (Proves the seeded master will authenticate via the package's identical `login()`.)
  - **Idempotency:** re-run the exact `init` command → it logs "master exists, skipping", config merge reports no change, exit 0.
- [ ] **Step 4: Clean up** the temp dir. Commit `chore: verify Stage 5 (local init e2e + hash round-trip + idempotency)` (empty if no repo files changed).
  > If `npx wrangler d1 ... --local` can't run in this environment, the unit tests (Tasks 1–2) + the config-merge assertion are the floor; report DONE_WITH_CONCERNS naming the wrangler-dependent checks skipped. Do NOT weaken the hash parity.

---

## Self-Review

**1. Spec coverage (spec §5):** `npx astro-cloudflare-cms init` ✓ (Task 3); D1/R2 create-or-detect ✓ (T3 steps 2–3); wrangler config merge of DB/MEDIA + vars + compat + nodejs_compat ✓ (T2, T3 step 4); migration copy + apply `--local`/`--remote` with tracking ✓ (T3 step 5); `.dev.vars` SESSION_SECRET + prod `secret put` guidance ✓ (T3 step 6); master user via PBKDF2 + `d1 execute` ✓ (T3 step 7, T1 parity); idempotent/resumable + clear errors ✓ (T3, T4 idempotency check); `npx wrangler` only ✓; future subcommands left open (only `init` now) ✓.

**2. Placeholder scan:** No TBD. Crypto + config-merge are complete code; the orchestrator steps are concrete (exact wrangler args, exact INSERT columns). The toml path is an explicit documented limitation (guidance, not silent).

**3. Type/interface consistency:** `hashPassword(password, saltB64?)→{hash,salt}` signature + params identical to `src/lib/auth.ts` (the parity test asserts byte-equality); users INSERT columns match the Stage-3 seed + migration; binding names `DB`/`MEDIA`, var names, compat date `2025-09-01`, flag `nodejs_compat` match the integration's injected `App.Locals` + the demo's wrangler.jsonc; `genSessionSecret` feeds the same `SESSION_SECRET` the middleware/auth read.
