import { existsSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// defaultWranglerConfig
// ---------------------------------------------------------------------------

/**
 * Return a minimal wrangler.jsonc string for a fresh project.
 * Deliberately omits `main` — @astrojs/cloudflare v14 generates the
 * runnable entry itself; including `main` would conflict.
 * @param {string} name  Sanitized project name (lowercase, hyphens only)
 * @returns {string}
 */
export function defaultWranglerConfig(name) {
  return JSON.stringify(
    {
      name,
      compatibility_date: '2025-09-01',
      compatibility_flags: ['nodejs_compat'],
    },
    null,
    2
  ) + '\n';
}

// ---------------------------------------------------------------------------
// findWranglerConfig
// ---------------------------------------------------------------------------

/**
 * Look for a wrangler config file in the given directory.
 * Returns { path, format } or null.
 * @param {string} dir
 * @returns {{ path: string; format: 'jsonc' | 'json' | 'toml' } | null}
 */
export function findWranglerConfig(dir) {
  const candidates = [
    { name: 'wrangler.jsonc', format: /** @type {'jsonc'} */ ('jsonc') },
    { name: 'wrangler.json', format: /** @type {'json'} */ ('json') },
    { name: 'wrangler.toml', format: /** @type {'toml'} */ ('toml') },
  ];
  for (const { name, format } of candidates) {
    const p = join(dir, name);
    if (existsSync(p)) return { path: p, format };
  }
  return null;
}

// ---------------------------------------------------------------------------
// JSONC comment stripper
// ---------------------------------------------------------------------------

/**
 * Strip // line comments and /* block * / comments from a JSONC string.
 * Handles strings (doesn't strip inside quoted values).
 * @param {string} src
 * @returns {string}
 */
function stripComments(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    // Inside a string — copy verbatim including escape sequences
    if (ch === '"') {
      out += ch;
      i++;
      while (i < src.length) {
        const sc = src[i];
        out += sc;
        i++;
        if (sc === '\\') {
          // Skip the escaped character
          if (i < src.length) { out += src[i]; i++; }
        } else if (sc === '"') {
          break;
        }
      }
      continue;
    }
    // Possible comment start
    if (ch === '/' && i + 1 < src.length) {
      if (src[i + 1] === '/') {
        // Line comment — skip to end of line
        i += 2;
        while (i < src.length && src[i] !== '\n') i++;
        continue;
      }
      if (src[i + 1] === '*') {
        // Block comment
        i += 2;
        while (i < src.length) {
          if (src[i] === '*' && i + 1 < src.length && src[i + 1] === '/') {
            i += 2;
            break;
          }
          i++;
        }
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// readDbBindingName
// ---------------------------------------------------------------------------

/**
 * Read the database_name of the d1_databases entry bound as `DB`.
 * Used by user-management CLI commands to target the configured database.
 * Returns null for toml (not parsed) or when no DB binding is present.
 * @param {string} text   Raw config file contents
 * @param {'jsonc'|'json'|'toml'} format
 * @returns {string | null}
 */
export function readDbBindingName(text, format) {
  if (format === 'toml') return null;
  let cfg;
  try {
    cfg = JSON.parse(stripComments(text));
  } catch {
    return null;
  }
  const list = Array.isArray(cfg?.d1_databases) ? cfg.d1_databases : [];
  const entry = list.find((e) => e && e.binding === 'DB');
  return entry && typeof entry.database_name === 'string' ? entry.database_name : null;
}

// ---------------------------------------------------------------------------
// Date comparison helpers
// ---------------------------------------------------------------------------

const TARGET_DATE = '2025-09-01';

/** Returns true if `existing` is absent or an earlier date string than `target`. */
function dateIsOlderOrAbsent(existing) {
  if (!existing || typeof existing !== 'string') return true;
  return existing < TARGET_DATE;
}

// ---------------------------------------------------------------------------
// mergeWranglerConfig
// ---------------------------------------------------------------------------

/**
 * Merge CMS-required settings into a wrangler config text.
 *
 * For jsonc/json:
 *   - Strips comments, JSON.parses, applies merge, re-serializes with
 *     JSON.stringify(cfg, null, 2). Comments are not preserved when changed.
 *   - Returns { text, changed }.
 *   - `changed` is false when nothing needed to be changed (idempotent).
 *     In that case `text` is the original input text unchanged.
 *
 * For toml:
 *   - Not parsed. Returns { text, changed: false } with a console warning
 *     describing the lines the user should add manually.
 *
 * Merge rules:
 *   d1_databases  — replace existing binding:'DB' entry or append one; keep others.
 *   r2_buckets    — replace existing binding:'MEDIA' entry or append one; keep others.
 *   compatibility_date — set to '2025-09-01' only if absent or older.
 *   compatibility_flags — dedup-add 'nodejs_compat'.
 *   vars.PUBLIC_R2_BASE_URL, vars.DEFAULT_EYECATCH_URL — add with '' if key absent.
 *
 * @param {string} text         Raw config file contents
 * @param {'jsonc'|'json'|'toml'} format
 * @param {{ dbName: string; dbId: string; bucketName: string }} opts
 * @returns {{ text: string; changed: boolean }}
 */
export function mergeWranglerConfig(text, format, { dbName, dbId, bucketName }) {
  if (format === 'toml') {
    console.warn(
      '[astro-cloudflare-cms] wrangler.toml detected — auto-merge is not supported.\n' +
      'Please add the following to your wrangler.toml manually:\n\n' +
      `compatibility_date = "${TARGET_DATE}"\n` +
      `compatibility_flags = ["nodejs_compat"]\n\n` +
      `[[d1_databases]]\n` +
      `binding = "DB"\n` +
      `database_name = "${dbName}"\n` +
      `database_id = "${dbId}"\n\n` +
      `[[r2_buckets]]\n` +
      `binding = "MEDIA"\n` +
      `bucket_name = "${bucketName}"\n\n` +
      `[vars]\n` +
      `PUBLIC_R2_BASE_URL = ""\n` +
      `DEFAULT_EYECATCH_URL = ""\n`
    );
    return { text, changed: false };
  }

  // --- Parse ---
  const stripped = stripComments(text);
  const cfg = JSON.parse(stripped);
  let changed = false;

  // --- d1_databases ---
  {
    const list = Array.isArray(cfg.d1_databases) ? cfg.d1_databases : [];
    const idx = list.findIndex((e) => e.binding === 'DB');
    const desired = { binding: 'DB', database_name: dbName, database_id: dbId };
    if (idx === -1) {
      list.push(desired);
      changed = true;
    } else {
      const e = list[idx];
      if (e.database_name !== dbName || e.database_id !== dbId) {
        list[idx] = desired;
        changed = true;
      }
    }
    cfg.d1_databases = list;
  }

  // --- r2_buckets ---
  {
    const list = Array.isArray(cfg.r2_buckets) ? cfg.r2_buckets : [];
    const idx = list.findIndex((e) => e.binding === 'MEDIA');
    const desired = { binding: 'MEDIA', bucket_name: bucketName };
    if (idx === -1) {
      list.push(desired);
      changed = true;
    } else {
      const e = list[idx];
      if (e.bucket_name !== bucketName) {
        list[idx] = desired;
        changed = true;
      }
    }
    cfg.r2_buckets = list;
  }

  // --- compatibility_date ---
  if (dateIsOlderOrAbsent(cfg.compatibility_date)) {
    cfg.compatibility_date = TARGET_DATE;
    changed = true;
  }

  // --- compatibility_flags ---
  {
    const flags = Array.isArray(cfg.compatibility_flags) ? cfg.compatibility_flags : [];
    if (!flags.includes('nodejs_compat')) {
      flags.push('nodejs_compat');
      cfg.compatibility_flags = flags;
      changed = true;
    } else {
      cfg.compatibility_flags = flags;
    }
  }

  // --- vars ---
  {
    const vars = cfg.vars && typeof cfg.vars === 'object' ? cfg.vars : {};
    if (!('PUBLIC_R2_BASE_URL' in vars)) {
      vars.PUBLIC_R2_BASE_URL = '';
      changed = true;
    }
    if (!('DEFAULT_EYECATCH_URL' in vars)) {
      vars.DEFAULT_EYECATCH_URL = '';
      changed = true;
    }
    cfg.vars = vars;
  }

  // --- Serialize ---
  if (!changed) {
    // Nothing changed — return the original text byte-for-byte.
    return { text, changed: false };
  }

  const newText = JSON.stringify(cfg, null, 2);
  return { text: newText, changed: true };
}
