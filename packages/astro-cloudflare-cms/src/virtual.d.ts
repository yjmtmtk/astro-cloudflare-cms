declare module 'virtual:acc-config' {
  import type { AccConfig } from './config-runtime';
  export const config: AccConfig;
}

declare namespace App {
  interface Locals {
    runtime: {
      env: {
        DB: D1Database;
        MEDIA: R2Bucket;
        SESSION_SECRET: string;
        PUBLIC_R2_BASE_URL?: string;
        DEFAULT_EYECATCH_URL?: string;
      };
    };
    user: import('./lib/types').SessionUser | null;
  }
}
