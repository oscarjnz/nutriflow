import 'server-only';

import { sql } from 'drizzle-orm';

import { adminDb } from '@/db/client';

/**
 * Trivial round-trip query used to keep the Supabase Postgres instance
 * active. Free-tier projects auto-pause after a period of inactivity;
 * this is invoked periodically (see `/api/cron/keep-alive`) so the
 * connection is never idle long enough to trigger that.
 */
export async function pingDatabase(): Promise<void> {
  await adminDb.execute(sql`select 1`);
}
