import { applyD1Migrations, env } from 'cloudflare:test';

// Setup files run outside isolated storage; this seeds the schema that each
// isolated test starts from. Reads the real migration files (no duplicated SQL).
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
