import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { env } from '@/env.server';

import { schema } from './schema';

/**
 * Database access has two distinct flavors:
 *
 *  1. `adminDb`  — bypasses RLS.
 *     Used for migrations, the seed script, catalog mutations, and trusted
 *     server code that operates on `nlp_cache` (which is service_role-only).
 *     Connects via the *direct* port (5432) with a single long-lived
 *     connection. Never expose to user-driven code paths.
 *
 *  2. `withUserContext(userId, fn)` — RLS active under role `authenticated`.
 *     Used by every Server Action, Route Handler, and Server Component that
 *     reads or writes user-owned data. Opens a pooled transaction, injects
 *     `request.jwt.claims.sub`, and switches role so that `auth.uid()`
 *     resolves to the caller. RLS policies enforce row visibility even if a
 *     repository forgets the `where user_id = $1` predicate — defense in
 *     depth.
 *
 * The pooled connection uses Supabase's transaction-mode pooler (port 6543),
 * which requires `prepare: false`. The pooler hands out connections per
 * transaction, so we must always wrap user-context work in a transaction or
 * the role/claims would leak across requests.
 */

export type AppDb = PostgresJsDatabase<typeof schema>;

// ── Admin (service_role / postgres) ─────────────────────────────────────────

const adminSql = postgres(env.DATABASE_URL_DIRECT, {
  max: 1,
  prepare: false,
  onnotice: () => {
    // suppress NOTICE chatter from migrations and triggers
  },
});

export const adminDb: AppDb = drizzle(adminSql, { schema, casing: 'snake_case' });

// ── Pooled (per-user, RLS active) ───────────────────────────────────────────

const pooledSql = postgres(env.DATABASE_URL_POOLER, {
  max: 10,
  prepare: false,
  idle_timeout: 20,
  onnotice: () => {},
});

const pooledDb: AppDb = drizzle(pooledSql, { schema, casing: 'snake_case' });

/**
 * Execute `fn` inside a transaction with RLS context bound to a Clerk user.
 *
 * Pattern:
 *   `set_config('request.jwt.claims', '{ "sub": "<clerkId>", "role": "authenticated" }', true)`
 *   `set local role authenticated`
 *
 * The `sub` is the **Clerk user id** so the `app_user_id()` SQL helper (see
 * migration 0011) resolves it to the internal UUID via the clerk_id mapping —
 * the same resolution path a direct browser query with a Clerk token uses.
 *
 * Both settings are transaction-local (`true` flag / `set local`), so they
 * never leak across requests even if the pooler reuses the underlying
 * connection.
 *
 * `clerkId` MUST come from a verified Clerk session (via `auth()`), never from
 * a raw client-supplied value.
 */
export async function withUserContext<T>(
  clerkId: string,
  fn: (tx: AppDb) => Promise<T>,
): Promise<T> {
  if (!clerkId) {
    throw new Error('withUserContext: clerkId must be a non-empty string');
  }
  const claims = JSON.stringify({ sub: clerkId, role: 'authenticated' });
  return pooledDb.transaction(async (tx) => {
    await tx.execute(sql`select set_config('request.jwt.claims', ${claims}, true)`);
    await tx.execute(sql`set local role authenticated`);
    return fn(tx);
  });
}

/**
 * Execute `fn` inside a transaction with role `anon` — no `auth.uid()`.
 *
 * Used for unauthenticated reads of the public catalog (foods, aliases,
 * barcodes, food_servings) when there is no session, e.g. on the landing
 * page or in a public preview.
 */
export async function withAnonContext<T>(fn: (tx: AppDb) => Promise<T>): Promise<T> {
  return pooledDb.transaction(async (tx) => {
    await tx.execute(sql`set local role anon`);
    return fn(tx);
  });
}

/**
 * Test helper: close every open pool so a Node process can exit cleanly.
 */
export async function closeDbConnections(): Promise<void> {
  await Promise.all([adminSql.end({ timeout: 5 }), pooledSql.end({ timeout: 5 })]);
}
