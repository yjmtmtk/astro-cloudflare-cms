import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { hashPassword, genPassword } from './crypto.mjs';
import { findWranglerConfig, readDbBindingName } from './wrangler-config.mjs';
import { run, log, warn, die, prompt } from './util.mjs';
import {
  sqlEsc,
  normalizeRole,
  isValidEmail,
  defaultNameFromEmail,
  buildInsertUserSql,
  buildUpdatePasswordSql,
  buildDeleteUserSql,
  parseD1Rows,
  formatUsersTable,
} from './users.mjs';

// ---------------------------------------------------------------------------
// Orchestration helpers (side-effecting wrappers around wrangler)
// ---------------------------------------------------------------------------

/** Resolve the target D1 database name: --db-name > config DB binding > dir-derived. */
function resolveDbName(flags, cwd) {
  if (typeof flags['db-name'] === 'string') return flags['db-name'];
  const cfg = findWranglerConfig(cwd);
  if (cfg) {
    try {
      const name = readDbBindingName(readFileSync(cfg.path, 'utf8'), cfg.format);
      if (name) return name;
    } catch {
      // fall through to derived default
    }
  }
  const base = basename(cwd).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'acc';
  return `${base}-db`;
}

function dbTarget(flags) {
  return flags.local ? '--local' : '--remote';
}

/** Run `wrangler d1 execute` with a SQL command; always captures output. */
function execSql(dbName, target, sql, cwd, { json = false } = {}) {
  const args = ['wrangler', 'd1', 'execute', dbName, target, ...(json ? ['--json'] : []), '--command', sql];
  return run('npx', args, { capture: true, cwd });
}

function queryRows(dbName, target, sql, cwd) {
  const res = execSql(dbName, target, sql, cwd, { json: true });
  if (res.status !== 0) {
    die(
      `D1 query failed (status ${res.status}) on "${dbName}" (${target}).\n` +
      `Check that the database exists and wrangler is authenticated.\n${res.stdout}`
    );
  }
  return parseD1Rows(res.stdout);
}

function countFrom(rows) {
  return Number(rows[0]?.c ?? 0);
}

/** Resolve email from flags/env/prompt and validate shape. */
async function resolveEmail(flags) {
  let email = typeof flags.email === 'string' ? flags.email : process.env.ACC_USER_EMAIL;
  if (!email) {
    if (flags.yes) die('--email (or ACC_USER_EMAIL env) is required with --yes');
    email = await prompt('Email: ');
  }
  if (!isValidEmail(email)) die(`Invalid email: ${email}`);
  return email;
}

/** Resolve a password: --generate (random) > --password/env > prompt. Min 8 chars. */
async function resolvePassword(flags) {
  if (flags.generate) return { password: genPassword(16), generated: true };
  let pw = typeof flags.password === 'string' ? flags.password : process.env.ACC_USER_PASSWORD;
  if (!pw) {
    if (flags.yes) die('--password / ACC_USER_PASSWORD / --generate is required with --yes');
    pw = await prompt('Password (min 8 chars): ');
  }
  if (!pw || pw.length < 8) die('Password must be at least 8 characters.');
  return { password: pw, generated: false };
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/** `create-user` — insert a new author (or master) user. */
export async function createUser(flags) {
  const cwd = process.cwd();
  const dbName = resolveDbName(flags, cwd);
  const target = dbTarget(flags);

  const email = await resolveEmail(flags);
  let role;
  try {
    role = normalizeRole(flags.role);
  } catch (e) {
    die(e.message);
  }
  const name = typeof flags.name === 'string' && flags.name.trim() ? flags.name.trim() : defaultNameFromEmail(email);

  log(`Creating ${role} user on D1 "${dbName}" (${target})…`);

  const dup = countFrom(queryRows(dbName, target, `SELECT COUNT(*) c FROM users WHERE email='${sqlEsc(email)}'`, cwd));
  if (dup > 0) die(`A user with email ${email} already exists.`);

  const { password, generated } = await resolvePassword(flags);
  const { hash, salt } = await hashPassword(password);
  const id = crypto.randomUUID();
  const createdAt = Math.floor(Date.now() / 1000);

  const res = execSql(dbName, target, buildInsertUserSql({ id, email, name, role, hash, salt, createdAt }), cwd);
  if (res.status !== 0) {
    if (res.stdout.includes('UNIQUE')) die(`A user with email ${email} already exists.`);
    die(`Failed to create user (status ${res.status}).\n${res.stdout}`);
  }

  log(`✓ Created ${role} user: ${email} (name: ${name})`);
  if (generated) log(`  Generated password: ${password}   ← shown once; store it now.`);
}

/** `list-users` — print all users. */
export async function listUsers(flags) {
  const cwd = process.cwd();
  const dbName = resolveDbName(flags, cwd);
  const target = dbTarget(flags);
  const rows = queryRows(dbName, target, 'SELECT id,email,role,name,created_at FROM users ORDER BY created_at ASC', cwd);
  if (flags.json) {
    log(JSON.stringify(rows, null, 2));
    return;
  }
  log(formatUsersTable(rows));
}

/** `delete-user` — remove a user by email (with safety guards). */
export async function deleteUser(flags) {
  const cwd = process.cwd();
  const dbName = resolveDbName(flags, cwd);
  const target = dbTarget(flags);
  const email = await resolveEmail(flags);

  const found = queryRows(dbName, target, `SELECT id,role FROM users WHERE email='${sqlEsc(email)}'`, cwd);
  if (found.length === 0) die(`No user found with email ${email}.`);
  const user = found[0];

  if (user.role === 'master') {
    const masters = countFrom(queryRows(dbName, target, "SELECT COUNT(*) c FROM users WHERE role='master'", cwd));
    if (masters <= 1) die('Refusing to delete the last master user.');
  }
  const articles = countFrom(
    queryRows(dbName, target, `SELECT COUNT(*) c FROM articles WHERE author_id='${sqlEsc(user.id)}'`, cwd)
  );
  if (articles > 0) die(`User has ${articles} article(s). Reassign or delete them first.`);

  if (!flags.yes) {
    const ans = (await prompt(`Delete user ${email} (${user.role})? [y/N]: `)).toLowerCase();
    if (ans !== 'y' && ans !== 'yes') {
      log('Aborted.');
      return;
    }
  }

  const res = execSql(dbName, target, buildDeleteUserSql({ id: user.id }), cwd);
  if (res.status !== 0) die(`Delete failed (status ${res.status}).\n${res.stdout}`);
  log(`✓ Deleted user: ${email}`);
}

/** `set-password` — reset a user's password by email. */
export async function setPassword(flags) {
  const cwd = process.cwd();
  const dbName = resolveDbName(flags, cwd);
  const target = dbTarget(flags);
  const email = await resolveEmail(flags);

  const found = queryRows(dbName, target, `SELECT id FROM users WHERE email='${sqlEsc(email)}'`, cwd);
  if (found.length === 0) die(`No user found with email ${email}.`);
  const id = found[0].id;

  const { password, generated } = await resolvePassword(flags);
  const { hash, salt } = await hashPassword(password);

  const res = execSql(dbName, target, buildUpdatePasswordSql({ id, hash, salt }), cwd);
  if (res.status !== 0) die(`Password update failed (status ${res.status}).\n${res.stdout}`);

  log(`✓ Password updated for ${email}`);
  if (generated) log(`  Generated password: ${password}   ← shown once; store it now.`);
}
