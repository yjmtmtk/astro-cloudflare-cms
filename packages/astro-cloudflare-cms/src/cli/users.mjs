// Pure, side-effect-free helpers for the user-management CLI commands.
//
// Kept free of node:child_process (and other non-portable imports) so the unit
// tests can import it under @cloudflare/vitest-pool-workers. The side-effecting
// orchestration (wrangler exec, prompts) lives in users-commands.mjs.

/** Escape single quotes for SQL string literals. */
export function sqlEsc(str) {
  return String(str).replace(/'/g, "''");
}

/**
 * Normalize a --role flag value. Absent → 'author'. Throws on anything other
 * than 'author' | 'master' (incl. boolean `true` from a value-less flag).
 * @param {unknown} value
 * @returns {'author' | 'master'}
 */
export function normalizeRole(value) {
  if (value === undefined || value === null) return 'author';
  if (value === 'author' || value === 'master') return value;
  throw new Error(`invalid role: ${String(value)} (expected "author" or "master")`);
}

/** Basic email shape check (local@domain.tld, no whitespace). */
export function isValidEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/** Default display name = email local part. */
export function defaultNameFromEmail(email) {
  return String(email).split('@')[0];
}

/**
 * @param {{ id: string; email: string; name: string; role: string; hash: string; salt: string; createdAt: number }} u
 * @returns {string}
 */
export function buildInsertUserSql({ id, email, name, role, hash, salt, createdAt }) {
  return (
    'INSERT INTO users (id,email,password_hash,password_salt,role,name,created_at) VALUES ' +
    `('${sqlEsc(id)}','${sqlEsc(email)}','${sqlEsc(hash)}','${sqlEsc(salt)}','${sqlEsc(role)}','${sqlEsc(name)}',${Number(createdAt)})`
  );
}

/** @param {{ id: string; hash: string; salt: string }} u */
export function buildUpdatePasswordSql({ id, hash, salt }) {
  return `UPDATE users SET password_hash='${sqlEsc(hash)}', password_salt='${sqlEsc(salt)}' WHERE id='${sqlEsc(id)}'`;
}

/** @param {{ id: string }} u */
export function buildDeleteUserSql({ id }) {
  return `DELETE FROM users WHERE id='${sqlEsc(id)}'`;
}

/**
 * Parse rows out of `wrangler d1 execute --json` output, which wraps result
 * sets as `[ { results: [...] } ]` (or sometimes a bare object). Returns the
 * first result set's rows, or [] on any parse failure.
 * @param {string} stdout
 * @returns {Array<Record<string, unknown>>}
 */
export function parseD1Rows(stdout) {
  try {
    const outer = JSON.parse(stdout);
    const sets = Array.isArray(outer) ? outer : [outer];
    for (const s of sets) {
      const rows = s?.results ?? s?.result ?? null;
      if (Array.isArray(rows)) return rows;
    }
  } catch {
    // ignore
  }
  return [];
}

/**
 * Render a list of user rows as an aligned text table.
 * @param {Array<Record<string, unknown>>} rows
 * @returns {string}
 */
export function formatUsersTable(rows) {
  if (!rows || rows.length === 0) return '(no users)';
  const fmtDate = (s) => {
    const n = Number(s);
    return Number.isFinite(n) ? new Date(n * 1000).toISOString().slice(0, 10) : String(s ?? '');
  };
  const header = ['EMAIL', 'NAME', 'ROLE', 'CREATED'];
  const lines = rows.map((r) => [String(r.email ?? ''), String(r.name ?? ''), String(r.role ?? ''), fmtDate(r.created_at)]);
  const widths = header.map((h, i) => Math.max(h.length, ...lines.map((l) => l[i].length)));
  const fmtRow = (cols) => cols.map((c, i) => String(c).padEnd(widths[i])).join('  ');
  return [fmtRow(header), ...lines.map(fmtRow)].join('\n');
}
