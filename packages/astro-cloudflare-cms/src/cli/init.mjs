import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { hashPassword, genSessionSecret } from './crypto.mjs';
import { findWranglerConfig, mergeWranglerConfig } from './wrangler-config.mjs';
import { run, log, warn, die, prompt } from './util.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escape single quotes for SQL string literals. */
function sqlEsc(str) {
  return str.replace(/'/g, "''");
}

/**
 * Parse the database_id from `wrangler d1 create` stdout.
 * Wrangler prints something like:  database_id = "abc-123"
 * @param {string} stdout
 * @returns {string | null}
 */
function parseDatabaseId(stdout) {
  const m = stdout.match(/database_id\s*[=:]\s*["']?([0-9a-f-]{36})["']?/i);
  return m ? m[1] : null;
}

/**
 * Extract the database_id for a named DB from `wrangler d1 list` output.
 * Wrangler may output plain text or JSON; try both.
 * @param {string} stdout
 * @param {string} dbName
 * @returns {string | null}
 */
function extractIdFromList(stdout, dbName) {
  // Try JSON first
  try {
    const arr = JSON.parse(stdout);
    if (Array.isArray(arr)) {
      const entry = arr.find((e) => e.name === dbName || e.Name === dbName);
      if (entry) return entry.uuid || entry.database_id || entry.UUID || null;
    }
  } catch {
    // fall through to text parsing
  }
  // Text table: look for a line containing dbName and a UUID
  const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  for (const line of stdout.split('\n')) {
    if (line.includes(dbName)) {
      const m = line.match(uuidRe);
      if (m) return m[0];
    }
  }
  return null;
}

/**
 * Parse the master-count from `wrangler d1 execute --json` stdout.
 * Wrangler wraps the result set: [ { results: [ { c: N } ] } ]
 * @param {string} stdout
 * @returns {number}
 */
function parseMasterCount(stdout) {
  try {
    const outer = JSON.parse(stdout);
    // Wrangler may return an array of result objects
    const resultSet = Array.isArray(outer) ? outer : [outer];
    for (const r of resultSet) {
      const rows = r.results ?? r.result ?? [];
      if (Array.isArray(rows) && rows.length > 0) {
        const val = rows[0].c ?? rows[0].C ?? rows[0]['COUNT(*)'];
        if (val !== undefined) return Number(val);
      }
    }
  } catch {
    // ignore parse errors
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Run the astro-cloudflare-cms init flow.
 * @param {Record<string, unknown>} flags
 */
export async function init(flags) {
  // ── Step 1: Resolve options ────────────────────────────────────────────────
  log('[1/8] Resolving options…');
  const cwd = process.cwd();
  // R2 bucket names allow only lowercase alphanumerics + hyphens; D1 names tolerate the same.
  // Derive defaults from a sanitized project name so both resources are valid for every wrangler command.
  const base = basename(cwd).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'acc';

  const dbName     = /** @type {string} */ (flags['db-name']      ?? `${base}-db`);
  const bucketName = /** @type {string} */ (flags['bucket-name']  ?? `${base}-media`);
  const local      = !!flags.local;
  const yes        = !!flags.yes;

  let masterEmail = /** @type {string | undefined} */ (
    flags['master-email'] ?? process.env.ACC_MASTER_EMAIL
  );
  let masterPassword = /** @type {string | undefined} */ (
    flags['master-password'] ?? process.env.ACC_MASTER_PASSWORD
  );

  if (!masterEmail) {
    if (yes) die('--master-email (or ACC_MASTER_EMAIL env) is required with --yes');
    masterEmail = await prompt('Master admin email: ');
    if (!masterEmail) die('Master email is required.');
  }
  if (!masterPassword) {
    if (yes) die('--master-password (or ACC_MASTER_PASSWORD env) is required with --yes');
    masterPassword = await prompt('Master admin password: ');
    if (!masterPassword) die('Master password is required.');
  }

  log(`  db: ${dbName}, bucket: ${bucketName}, local: ${local}`);

  // ── Step 2: D1 ────────────────────────────────────────────────────────────
  log('[2/8] Setting up D1 database…');
  let dbId = 'local-placeholder';

  if (local) {
    log('  --local flag set; skipping D1 account call, using local-placeholder.');
  } else {
    const createResult = run('npx', ['wrangler', 'd1', 'create', dbName], { capture: true });
    const combined = createResult.stdout;

    if (createResult.status === 0) {
      const parsed = parseDatabaseId(combined);
      if (parsed) {
        dbId = parsed;
        log(`  Created D1 database. database_id: ${dbId}`);
      } else {
        warn(`  Could not parse database_id from output. Falling back to local-placeholder.`);
        warn(`  Output was:\n${combined}`);
        dbId = 'local-placeholder';
      }
    } else {
      // Check if "already exists"
      if (combined.includes('already exists') || combined.includes('AlreadyExists')) {
        log('  D1 database already exists; fetching id via d1 list…');
        const listResult = run('npx', ['wrangler', 'd1', 'list', '--json'], { capture: true });
        if (listResult.status === 0) {
          const found = extractIdFromList(listResult.stdout, dbName);
          if (found) {
            dbId = found;
            log(`  Found existing database_id: ${dbId}`);
          } else {
            warn(`  Could not extract id from d1 list. Falling back to local-placeholder.`);
            dbId = 'local-placeholder';
          }
        } else {
          // Try without --json flag (older wrangler)
          const listResult2 = run('npx', ['wrangler', 'd1', 'list'], { capture: true });
          const found = extractIdFromList(listResult2.stdout, dbName);
          if (found) {
            dbId = found;
            log(`  Found existing database_id: ${dbId}`);
          } else {
            warn(`  Could not extract id from d1 list. Falling back to local-placeholder.`);
            dbId = 'local-placeholder';
          }
        }
      } else if (
        combined.includes('not authenticated') ||
        combined.includes('Unauthorized') ||
        combined.includes('auth') ||
        combined.includes('login')
      ) {
        warn('  Wrangler auth failure when creating D1 database.');
        warn('  Falling back to local-placeholder. Run `npx wrangler login` and re-run init to fix.');
        dbId = 'local-placeholder';
      } else {
        warn(`  D1 create exited with status ${createResult.status}. Output:\n${combined}`);
        warn('  Falling back to local-placeholder. Verify wrangler auth and re-run.');
        dbId = 'local-placeholder';
      }
    }
  }

  // ── Step 3: R2 ────────────────────────────────────────────────────────────
  log('[3/8] Setting up R2 bucket…');
  if (local) {
    log('  --local flag set; skipping R2 (miniflare auto-provisions).');
  } else {
    const r2Result = run('npx', ['wrangler', 'r2', 'bucket', 'create', bucketName], { capture: true });
    if (r2Result.status !== 0) {
      const out = r2Result.stdout;
      if (out.includes('already exists') || out.includes('AlreadyExists')) {
        log(`  R2 bucket "${bucketName}" already exists; skipping.`);
      } else {
        warn(`  R2 bucket create failed (status ${r2Result.status}). Output:\n${out}`);
        warn('  Continuing — you can create the bucket manually later.');
      }
    } else {
      log(`  R2 bucket "${bucketName}" created.`);
    }
  }

  // ── Step 4: Wrangler config ────────────────────────────────────────────────
  log('[4/8] Updating wrangler config…');
  const cfgInfo = findWranglerConfig(cwd);
  if (!cfgInfo) {
    die(
      '[4/8] No wrangler config found in the current directory.\n' +
      'Create wrangler.jsonc / wrangler.json / wrangler.toml first, then re-run:\n' +
      '  npx astro-cloudflare-cms init'
    );
  }

  const rawText = readFileSync(cfgInfo.path, 'utf8');
  let mergeResult;
  try {
    mergeResult = mergeWranglerConfig(rawText, cfgInfo.format, { dbName, dbId, bucketName });
  } catch (err) {
    die(
      `[4/8] Failed to parse ${cfgInfo.path}: ${err.message}\n` +
      'Fix the config file syntax, then re-run: npx astro-cloudflare-cms init'
    );
  }

  if (cfgInfo.format === 'toml') {
    // mergeWranglerConfig already printed the manual instructions via console.warn
    log('  wrangler.toml detected — see warnings above for lines to add manually.');
  } else if (mergeResult.changed) {
    if (rawText.match(/\/\/|\/\*/)) {
      warn('  JSONC comments were present; they have been removed in the merged output.');
    }
    writeFileSync(cfgInfo.path, mergeResult.text, 'utf8');
    log(`  ${cfgInfo.path} updated with D1/R2 bindings and compatibility settings.`);
  } else {
    log(`  ${cfgInfo.path} already up-to-date; no changes needed.`);
  }

  // ── Step 5: Migrations ────────────────────────────────────────────────────
  log('[5/8] Running D1 migrations…');
  const migrationsDir = join(cwd, 'migrations');
  if (!existsSync(migrationsDir)) {
    mkdirSync(migrationsDir, { recursive: true });
    log(`  Created ${migrationsDir}`);
  }

  const targetSql = join(migrationsDir, '0001_init.sql');
  if (!existsSync(targetSql)) {
    const sourceSql = new URL('../../migrations/0001_init.sql', import.meta.url);
    copyFileSync(sourceSql, targetSql);
    log(`  Copied 0001_init.sql to ${targetSql}`);
  } else {
    log(`  ${targetSql} already present; skipping copy.`);
  }

  const migrateArgs = ['wrangler', 'd1', 'migrations', 'apply', dbName];
  if (local) migrateArgs.push('--local'); else migrateArgs.push('--remote');
  const migrateResult = run('npx', migrateArgs, { cwd });
  if (migrateResult.status !== 0) {
    die(
      `[5/8] Migration failed (status ${migrateResult.status}).\n` +
      `Resume with: npx wrangler d1 migrations apply ${dbName} ${local ? '--local' : '--remote'}`
    );
  }
  log('  Migrations applied successfully.');

  // ── Step 6: SESSION_SECRET ────────────────────────────────────────────────
  log('[6/8] Checking SESSION_SECRET…');
  const devVarsPath = join(cwd, '.dev.vars');
  let devVarsContent = '';
  if (existsSync(devVarsPath)) {
    devVarsContent = readFileSync(devVarsPath, 'utf8');
  }

  if (!devVarsContent.includes('SESSION_SECRET')) {
    const secret = genSessionSecret();
    const append = devVarsContent.endsWith('\n') || devVarsContent === ''
      ? `SESSION_SECRET=${secret}\n`
      : `\nSESSION_SECRET=${secret}\n`;
    writeFileSync(devVarsPath, devVarsContent + append, 'utf8');
    log(`  SESSION_SECRET added to ${devVarsPath}`);
  } else {
    log('  SESSION_SECRET already present in .dev.vars; skipping.');
  }
  log('  For production, run: npx wrangler secret put SESSION_SECRET');

  // ── Step 7: Master user ───────────────────────────────────────────────────
  log('[7/8] Provisioning master user…');
  const dbTarget = local ? '--local' : '--remote';
  const countArgs = [
    'wrangler', 'd1', 'execute', dbName,
    dbTarget,
    '--json',
    '--command', "SELECT COUNT(*) c FROM users WHERE role='master'",
  ];
  const countResult = run('npx', countArgs, { capture: true, cwd });
  let masterExists = false;

  if (countResult.status === 0) {
    const count = parseMasterCount(countResult.stdout);
    if (count > 0) {
      masterExists = true;
      log('  Master user already exists; skipping INSERT.');
    }
  } else {
    warn(`  Could not check master count (status ${countResult.status}). Will attempt INSERT.`);
    warn(`  Output: ${countResult.stdout}`);
  }

  if (!masterExists) {
    let hashResult;
    try {
      hashResult = await hashPassword(masterPassword);
    } catch (err) {
      die(`[7/8] Password hashing failed: ${err.message}`);
    }

    const { hash, salt } = hashResult;
    const id = crypto.randomUUID();
    const createdAt = Math.floor(Date.now() / 1000);
    const safeEmail = sqlEsc(masterEmail);
    const safeName  = sqlEsc('管理者');
    const safeHash  = sqlEsc(hash);
    const safeSalt  = sqlEsc(salt);

    const insertSql =
      `INSERT INTO users (id,email,password_hash,password_salt,role,name,created_at) VALUES ` +
      `('${id}','${safeEmail}','${safeHash}','${safeSalt}','master','${safeName}',${createdAt})`;

    const insertArgs = [
      'wrangler', 'd1', 'execute', dbName,
      dbTarget,
      '--command', insertSql,
    ];
    const insertResult = run('npx', insertArgs, { cwd });
    if (insertResult.status !== 0) {
      die(
        `[7/8] Failed to insert master user (status ${insertResult.status}).\n` +
        `Resume with: npx astro-cloudflare-cms init [same flags]`
      );
    }
    log(`  Master user created: ${masterEmail}`);
  }

  // ── Step 8: Done ─────────────────────────────────────────────────────────
  log('');
  log('[8/8] Setup complete! Next steps:');
  log('');
  log('  1. Build the project:');
  log('       npm run build && npx wrangler dev');
  log('');
  log('  2. Log in at /admin/login');
  log('');
  log('  3. Before deploying, set the production session secret:');
  log('       npx wrangler secret put SESSION_SECRET');
  log('');
}
