import { describe, it, expect } from 'vitest';
import {
  normalizeRole,
  isValidEmail,
  defaultNameFromEmail,
  buildInsertUserSql,
  buildUpdatePasswordSql,
  buildDeleteUserSql,
  parseD1Rows,
  formatUsersTable,
} from '../src/cli/users.mjs';
import { genPassword } from '../src/cli/crypto.mjs';
import { readDbBindingName } from '../src/cli/wrangler-config.mjs';

describe('normalizeRole', () => {
  it('defaults to author when absent', () => {
    expect(normalizeRole(undefined)).toBe('author');
    expect(normalizeRole(null)).toBe('author');
  });
  it('accepts author and master', () => {
    expect(normalizeRole('author')).toBe('author');
    expect(normalizeRole('master')).toBe('master');
  });
  it('throws on an invalid role (incl. boolean from a value-less flag)', () => {
    expect(() => normalizeRole('admin')).toThrow();
    expect(() => normalizeRole(true)).toThrow();
  });
});

describe('isValidEmail', () => {
  it('accepts well-formed addresses', () => {
    expect(isValidEmail('taro@example.com')).toBe(true);
    expect(isValidEmail('a.b+c@sub.example.co.jp')).toBe(true);
  });
  it('rejects malformed addresses', () => {
    expect(isValidEmail('nope')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('a @b.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('defaultNameFromEmail', () => {
  it('uses the local part', () => {
    expect(defaultNameFromEmail('taro@example.com')).toBe('taro');
  });
});

describe('SQL builders (escape single quotes)', () => {
  it('buildInsertUserSql', () => {
    const sql = buildInsertUserSql({
      id: 'id-1', email: "o'brien@x.com", name: "O'Brien", role: 'author',
      hash: 'HASH', salt: 'SALT', createdAt: 1700000000,
    });
    expect(sql).toMatch(/^INSERT INTO users/);
    expect(sql).toContain("'id-1'");
    expect(sql).toContain("o''brien@x.com");
    expect(sql).toContain("O''Brien");
    expect(sql).toContain("'author'");
    expect(sql).toContain("'HASH'");
    expect(sql).toContain("'SALT'");
    expect(sql).toContain('1700000000');
  });
  it('buildUpdatePasswordSql', () => {
    const sql = buildUpdatePasswordSql({ id: 'id-1', hash: 'H', salt: 'S' });
    expect(sql).toContain('UPDATE users SET');
    expect(sql).toContain("password_hash='H'");
    expect(sql).toContain("password_salt='S'");
    expect(sql).toContain("WHERE id='id-1'");
  });
  it('buildDeleteUserSql', () => {
    expect(buildDeleteUserSql({ id: "x'1" })).toBe("DELETE FROM users WHERE id='x''1'");
  });
});

describe('parseD1Rows', () => {
  it('extracts the first result set rows (array envelope)', () => {
    const out = JSON.stringify([{ results: [{ id: '1', email: 'a@x' }], success: true }]);
    expect(parseD1Rows(out)).toEqual([{ id: '1', email: 'a@x' }]);
  });
  it('handles object envelope and bad input', () => {
    expect(parseD1Rows(JSON.stringify({ results: [{ c: 2 }] }))).toEqual([{ c: 2 }]);
    expect(parseD1Rows('not json')).toEqual([]);
    expect(parseD1Rows(JSON.stringify([{ results: [] }]))).toEqual([]);
  });
});

describe('formatUsersTable', () => {
  it('renders email, role and name', () => {
    const text = formatUsersTable([
      { id: 'i', email: 'a@x.com', role: 'master', name: '管理者', created_at: 1700000000 },
    ]);
    expect(text).toContain('a@x.com');
    expect(text).toContain('master');
    expect(text).toContain('管理者');
  });
  it('handles empty list', () => {
    expect(formatUsersTable([])).toMatch(/no users|ユーザー/i);
  });
});

describe('genPassword', () => {
  it('returns a string of the requested length from an unambiguous charset', () => {
    const p = genPassword();
    expect(typeof p).toBe('string');
    expect(p.length).toBe(16);
    expect(genPassword(24).length).toBe(24);
    // unambiguous: no 0/O/1/l/I
    expect(/^[A-HJ-NP-Za-km-z2-9]+$/.test(genPassword(64))).toBe(true);
  });
});

describe('readDbBindingName', () => {
  it('reads database_name for binding DB from jsonc (with comments)', () => {
    const jsonc = '{ // hi\n "d1_databases": [{ "binding": "DB", "database_name": "my_db", "database_id": "x" }] }';
    expect(readDbBindingName(jsonc, 'jsonc')).toBe('my_db');
  });
  it('returns null when no DB binding / for toml', () => {
    expect(readDbBindingName('{}', 'json')).toBeNull();
    expect(readDbBindingName('{ "d1_databases": [{ "binding": "OTHER", "database_name": "o" }] }', 'json')).toBeNull();
    expect(readDbBindingName('anything', 'toml')).toBeNull();
  });
});
