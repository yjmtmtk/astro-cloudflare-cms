import path from 'node:path';
import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, 'migrations'));
  return {
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    test: {
      setupFiles: ['./test/apply-migrations.ts'],
      poolOptions: {
        workers: {
          singleWorker: true,
          miniflare: {
            compatibilityDate: '2025-02-04',
            compatibilityFlags: ['nodejs_compat'],
            d1Databases: ['DB'],
            r2Buckets: ['MEDIA'],
            bindings: { SESSION_SECRET: 'test-secret', TEST_MIGRATIONS: migrations },
          },
        },
      },
    },
  };
});
