import { describe, it, expect } from 'vitest';
import { mergeWranglerConfig, defaultWranglerConfig } from '../src/cli/wrangler-config.mjs';

const base = `{
  "name": "demo",
  "compatibility_date": "2024-01-01"
}`;

describe('defaultWranglerConfig', () => {
  it('produces valid JSON with the given name', () => {
    const text = defaultWranglerConfig('my-project');
    const cfg = JSON.parse(text);
    expect(cfg.name).toBe('my-project');
  });

  it('sets compatibility_date to 2025-09-01', () => {
    const cfg = JSON.parse(defaultWranglerConfig('x'));
    expect(cfg.compatibility_date).toBe('2025-09-01');
  });

  it('includes nodejs_compat in compatibility_flags', () => {
    const cfg = JSON.parse(defaultWranglerConfig('x'));
    expect(cfg.compatibility_flags).toContain('nodejs_compat');
  });

  it('does NOT include a main field', () => {
    const cfg = JSON.parse(defaultWranglerConfig('x'));
    expect(cfg).not.toHaveProperty('main');
  });

  it('mergeWranglerConfig round-trip: merging DB/MEDIA on top of default produces correct bindings', () => {
    const base = defaultWranglerConfig('round-trip-test');
    const { text, changed } = mergeWranglerConfig(base, 'jsonc', {
      dbName: 'rt-db',
      dbId: 'abc-123',
      bucketName: 'rt-media',
    });
    expect(changed).toBe(true);
    const cfg = JSON.parse(text);
    expect(cfg.d1_databases).toEqual([{ binding: 'DB', database_name: 'rt-db', database_id: 'abc-123' }]);
    expect(cfg.r2_buckets).toEqual([{ binding: 'MEDIA', bucket_name: 'rt-media' }]);
    expect(cfg.compatibility_date).toBe('2025-09-01');
    expect(cfg.compatibility_flags).toContain('nodejs_compat');
    // nodejs_compat must appear exactly once (no duplication)
    expect(cfg.compatibility_flags.filter((f: string) => f === 'nodejs_compat')).toHaveLength(1);
  });
});

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
    expect(cfg.compatibility_flags.filter((f: string) => f === 'nodejs_compat')).toHaveLength(1);
    expect(cfg.d1_databases.map((d: { binding: string }) => d.binding).sort()).toEqual(['DB', 'OTHER']);
  });
});
