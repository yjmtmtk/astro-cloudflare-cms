import type { D1Migration } from '@cloudflare/vitest-pool-workers/config';

declare module 'cloudflare:test' {
  interface ProvidedEnv {
    DB: D1Database;
    MEDIA: R2Bucket;
    SESSION_SECRET: string;
    TEST_MIGRATIONS: D1Migration[];
  }
}
