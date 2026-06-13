import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '.env.local' });

const url = process.env.DATABASE_URL_DIRECT;
if (!url) {
  throw new Error('DATABASE_URL_DIRECT is required to run drizzle-kit');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  casing: 'snake_case',
  schemaFilter: ['public'],
  dbCredentials: { url },
  // SQL in `supabase/migrations/` is the source of truth. `drizzle-kit
  // generate` is intentionally not part of the workflow; this config exists
  // so `drizzle-kit studio` can introspect the database when debugging.
  verbose: false,
  strict: true,
});
