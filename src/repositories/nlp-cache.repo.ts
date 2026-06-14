import 'server-only';

import { and, eq, sql } from 'drizzle-orm';

import { adminDb } from '@/db/client';
import { nlpCache } from '@/db/schema';
import { newId } from '@/lib/crypto/uuid';
import { type ParseResponse, parseResponseSchema } from '@/lib/validation/nlp';

/**
 * `nlp_cache` is service_role-only (RLS revokes anon/authenticated), so every
 * access goes through `adminDb`. The cache stores the LLM *extraction*
 * (ParseResponse), never the catalog candidates - candidates are re-ranked
 * live so cache hits still reflect the current `foods` table.
 *
 * The unique key is (input_hash, model): bumping the model in env invalidates
 * the cache automatically without a migration.
 */

export interface CachedParse {
  id: string;
  parsed: ParseResponse;
}

export async function findCachedParse(
  inputHash: string,
  model: string,
): Promise<CachedParse | null> {
  const rows = await adminDb
    .select({ id: nlpCache.id, parsedResult: nlpCache.parsedResult })
    .from(nlpCache)
    .where(and(eq(nlpCache.inputHash, inputHash), eq(nlpCache.model, model)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  // Stored JSON is validated on read: a schema change that the cached row no
  // longer satisfies is treated as a miss rather than crashing the request.
  const parsed = parseResponseSchema.safeParse(row.parsedResult);
  if (!parsed.success) return null;

  return { id: row.id, parsed: parsed.data };
}

export async function bumpHit(id: string): Promise<void> {
  await adminDb
    .update(nlpCache)
    .set({ hitCount: sql`${nlpCache.hitCount} + 1`, lastHitAt: sql`now()` })
    .where(eq(nlpCache.id, id));
}

export async function persistParse(params: {
  inputHash: string;
  inputText: string;
  model: string;
  parsed: ParseResponse;
}): Promise<void> {
  await adminDb
    .insert(nlpCache)
    .values({
      id: newId(),
      inputHash: params.inputHash,
      inputText: params.inputText,
      model: params.model,
      parsedResult: params.parsed,
    })
    .onConflictDoNothing({ target: [nlpCache.inputHash, nlpCache.model] });
}

/** Wipe a user's cached inputs is not applicable here (cache is global by hash);
 * the privacy "clear cache" affordance in CLAUDE.md §6 is implemented at the
 * row level by matching input_text the user submitted. Exposed for that use. */
export async function deleteByInputText(inputText: string): Promise<void> {
  await adminDb.delete(nlpCache).where(eq(nlpCache.inputText, inputText));
}
