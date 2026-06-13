/**
 * Run every SQL file in `supabase/migrations/` against the direct-connection
 * Postgres URL, in filename order. Records applied migrations in a
 * `_migrations` table so the script is safe to re-run.
 *
 * Why a custom runner instead of `drizzle-kit migrate`:
 *   The SQL we write contains DDL Drizzle does not model (extensions, RLS
 *   policies, triggers, generated columns, custom functions). Drizzle's
 *   journal would not understand them. A 60-line runner keeps the migration
 *   contract obvious and the journal in our own table.
 *
 * Usage: `pnpm db:migrate`
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'supabase', 'migrations');

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL_DIRECT;
  if (!url) {
    throw new Error('DATABASE_URL_DIRECT is required');
  }

  const sql = postgres(url, {
    max: 1,
    prepare: false,
    onnotice: () => {},
  });

  try {
    await sql`
      create table if not exists public._migrations (
        name        text primary key,
        applied_at  timestamptz not null default now()
      )
    `;

    const entries = await readdir(MIGRATIONS_DIR);
    const files = entries.filter((f) => f.endsWith('.sql')).sort();

    if (files.length === 0) {
      console.info('No migrations found.');
      return;
    }

    for (const file of files) {
      const [row] = await sql<{ exists: boolean }[]>`
        select exists(select 1 from public._migrations where name = ${file}) as exists
      `;
      if (row?.exists) {
        console.info(`✓ ${file} (already applied)`);
        continue;
      }

      const filePath = path.join(MIGRATIONS_DIR, file);
      const ddl = await readFile(filePath, 'utf-8');

      console.info(`→ ${file}`);
      await sql.begin(async (tx) => {
        await tx.unsafe(ddl);
        await tx`insert into public._migrations (name) values (${file})`;
      });
      console.info(`✓ ${file}`);
    }

    console.info(`Applied ${files.length} migration(s).`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err: unknown) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
