import 'server-only';

import { sql } from 'drizzle-orm';

import { adminDb } from '@/db/client';
import type { FoodCandidate } from '@/lib/validation/nlp';

/**
 * Deterministic catalog search (CLAUDE.md §5: ranking is code, not LLM).
 *
 * Three signals are unioned and the best score per food wins:
 *   1. Full-text on `foods.search_vector` (tsvector, 'simple' + unaccent).
 *   2. Trigram similarity on `food_aliases.alias_text` (GIN gin_trgm_ops).
 *   3. Trigram fallback on the food's own Spanish name.
 *
 * Catalog tables are public-read, so reads go through `adminDb` (no per-user
 * scoping needed) which avoids a pooler round-trip on the hot logging path.
 */

interface SearchRow {
  food_id: string;
  name_es: string;
  name_en: string;
  score: number;
  matched_via: 'name' | 'alias' | 'trigram';
}

export async function searchFoodCandidates(
  queryTerms: readonly string[],
  limit = 5,
): Promise<FoodCandidate[]> {
  const query = queryTerms.join(' ').trim();
  if (query.length === 0) return [];

  // `execute` returns the postgres.js RowList (array-like with the selected
  // columns). We type the rows explicitly since raw SQL is untyped by drizzle.
  const result = await adminDb.execute(sql`
    with q as (
      select
        websearch_to_tsquery('simple', f_unaccent(${query})) as tsq,
        f_unaccent(lower(${query}))                          as raw
    )
    select
      food_id,
      name_es,
      name_en,
      max(score)                                      as score,
      (array_agg(matched_via order by score desc))[1] as matched_via
    from (
      select f.id as food_id, f.name_es, f.name_en,
             ts_rank(f.search_vector, q.tsq) as score,
             'name' as matched_via
      from foods f, q
      where q.tsq is not null and f.search_vector @@ q.tsq

      union all

      select a.food_id, f.name_es, f.name_en,
             similarity(f_unaccent(lower(a.alias_text)), q.raw) as score,
             'alias' as matched_via
      from food_aliases a
      join foods f on f.id = a.food_id, q
      where f_unaccent(lower(a.alias_text)) % q.raw

      union all

      select f.id as food_id, f.name_es, f.name_en,
             similarity(f_unaccent(lower(f.name_es)), q.raw) as score,
             'trigram' as matched_via
      from foods f, q
      where f_unaccent(lower(f.name_es)) % q.raw
    ) matches
    group by food_id, name_es, name_en
    order by score desc
    limit ${limit}
  `);

  const rows = result as unknown as SearchRow[];

  return rows.map((r) => ({
    foodId: r.food_id,
    nameEs: r.name_es,
    nameEn: r.name_en,
    // ts_rank and similarity live on different scales; clamp to the schema's
    // 0..1 so the UI can render a consistent confidence affordance.
    score: Math.min(1, Math.max(0, Number(r.score))),
    matchedVia: r.matched_via,
  }));
}

/** Fetch the columns needed to snapshot macros when logging a meal item. */
export async function getFoodForSnapshot(foodId: string): Promise<{
  id: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number | null;
  sugarPer100g: number | null;
  sodiumPer100g: number | null;
  servingSize: number;
  servingUnit: string;
} | null> {
  const result = await adminDb.execute(sql`
    select id, calories, protein, carbs, fat, fiber, sugar, sodium,
           serving_size, serving_unit
    from foods
    where id = ${foodId}
    limit 1
  `);

  const rows = result as unknown as Array<{
    id: string;
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
    fiber: string | null;
    sugar: string | null;
    sodium: string | null;
    serving_size: string;
    serving_unit: string;
  }>;

  const r = rows[0];
  if (!r) return null;

  return {
    id: r.id,
    caloriesPer100g: Number(r.calories),
    proteinPer100g: Number(r.protein),
    carbsPer100g: Number(r.carbs),
    fatPer100g: Number(r.fat),
    fiberPer100g: r.fiber === null ? null : Number(r.fiber),
    sugarPer100g: r.sugar === null ? null : Number(r.sugar),
    sodiumPer100g: r.sodium === null ? null : Number(r.sodium),
    servingSize: Number(r.serving_size),
    servingUnit: r.serving_unit,
  };
}
