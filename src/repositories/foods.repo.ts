import 'server-only';

import { sql } from 'drizzle-orm';
import { v5 as uuidv5 } from 'uuid';

import { adminDb } from '@/db/client';
import { lookupOffBarcode, type OffFood } from '@/lib/off/client';
import type { FoodCandidate } from '@/lib/validation/nlp';

/** Fixed namespace so a barcode always maps to the same food id (idempotent). */
const OFF_NAMESPACE = 'b6e0f9a2-3c4d-4e5f-8a9b-0c1d2e3f4a5b';

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

export interface FoodSearchResult {
  /** Local rows carry their UUID; un-imported OFF hits use an `off:<barcode>`
   *  sentinel so the UI can tell them apart and resolve on select. */
  id: string;
  origin: 'local' | 'off';
  barcode: string | null;
  brand: string | null;
  nameEs: string;
  nameEn: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  defaultServingGrams: number | null;
  defaultServingLabel: string | null;
}

/** Map a live OFF product to a search result the UI can render and select. */
export function offFoodToResult(off: OffFood): FoodSearchResult {
  return {
    id: `off:${off.barcode}`,
    origin: 'off',
    barcode: off.barcode,
    brand: off.brand,
    nameEs: off.nameEs,
    nameEn: off.nameEn,
    caloriesPer100g: off.calories,
    proteinPer100g: off.protein,
    carbsPer100g: off.carbs,
    fatPer100g: off.fat,
    defaultServingGrams: null,
    defaultServingLabel: null,
  };
}

/**
 * Free-text food search for manual logging. Same tsvector + trigram signals as
 * `searchFoodCandidates`, but returns the macros and the default serving so the
 * UI can show "por 100 g" and prefill a sensible portion - no second query.
 */
export async function searchFoods(query: string, limit = 12): Promise<FoodSearchResult[]> {
  const q = query.trim();
  if (q.length === 0) return [];

  const result = await adminDb.execute(sql`
    with q as (
      select
        websearch_to_tsquery('simple', f_unaccent(${q})) as tsq,
        f_unaccent(lower(${q}))                          as raw
    ),
    matches as (
      select f.id, ts_rank(f.search_vector, q.tsq) as score
      from foods f, q
      where q.tsq is not null and f.search_vector @@ q.tsq
      union all
      select a.food_id as id, similarity(f_unaccent(lower(a.alias_text)), q.raw) as score
      from food_aliases a, q
      where f_unaccent(lower(a.alias_text)) % q.raw
      union all
      select f.id, similarity(f_unaccent(lower(f.name_es)), q.raw) as score
      from foods f, q
      where f_unaccent(lower(f.name_es)) % q.raw
    ),
    ranked as (
      select id, max(score) as score from matches group by id
    )
    select
      f.id, f.name_es, f.name_en, f.barcode, f.calories, f.protein, f.carbs, f.fat,
      fs.grams as serving_grams, fs.label as serving_label
    from ranked
    join foods f on f.id = ranked.id
    left join food_servings fs on fs.food_id = f.id and fs.is_default = true
    order by ranked.score desc
    limit ${limit}
  `);

  const rows = result as unknown as Array<{
    id: string;
    name_es: string;
    name_en: string;
    barcode: string | null;
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
    serving_grams: string | null;
    serving_label: string | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    origin: 'local' as const,
    barcode: r.barcode,
    brand: null,
    nameEs: r.name_es,
    nameEn: r.name_en,
    caloriesPer100g: Number(r.calories),
    proteinPer100g: Number(r.protein),
    carbsPer100g: Number(r.carbs),
    fatPer100g: Number(r.fat),
    defaultServingGrams: r.serving_grams === null ? null : Number(r.serving_grams),
    defaultServingLabel: r.serving_label,
  }));
}

/** Load a single local food as a search result (used after a barcode import). */
export async function getFoodResultById(foodId: string): Promise<FoodSearchResult | null> {
  const result = await adminDb.execute(sql`
    select
      f.id, f.name_es, f.name_en, f.barcode, f.calories, f.protein, f.carbs, f.fat,
      fs.grams as serving_grams, fs.label as serving_label
    from foods f
    left join food_servings fs on fs.food_id = f.id and fs.is_default = true
    where f.id = ${foodId}
    limit 1
  `);

  const rows = result as unknown as Array<{
    id: string;
    name_es: string;
    name_en: string;
    barcode: string | null;
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
    serving_grams: string | null;
    serving_label: string | null;
  }>;

  const r = rows[0];
  if (!r) return null;

  return {
    id: r.id,
    origin: 'local',
    barcode: r.barcode,
    brand: null,
    nameEs: r.name_es,
    nameEn: r.name_en,
    caloriesPer100g: Number(r.calories),
    proteinPer100g: Number(r.protein),
    carbsPer100g: Number(r.carbs),
    fatPer100g: Number(r.fat),
    defaultServingGrams: r.serving_grams === null ? null : Number(r.serving_grams),
    defaultServingLabel: r.serving_label,
  };
}

/**
 * Resolve a barcode to a local food id, importing from Open Food Facts on miss.
 *
 * 1. The `barcodes` table is the dedup key - seeded products and previously
 *    imported ones short-circuit here (no OFF call, no duplicate row).
 * 2. On miss, fetch OFF live. If OFF has no usable product, return null.
 * 3. Persist with deterministic ids (uuidv5 of the barcode) so repeat/concurrent
 *    imports collide on the primary key instead of creating duplicates.
 *
 * Catalog writes go through `adminDb` (foods/barcodes are service_role-write).
 */
export async function findOrImportByBarcode(barcode: string): Promise<string | null> {
  const existing = await adminDb.execute(sql`
    select food_id from barcodes where barcode = ${barcode} limit 1
  `);
  const hit = (existing as unknown as Array<{ food_id: string }>)[0];
  if (hit) return hit.food_id;

  const off = await lookupOffBarcode(barcode);
  if (!off) return null;

  return importOffFood(off);
}

/**
 * Persist a live OFF product into the catalog and return its food id. Idempotent:
 * the food id is derived from the barcode, and barcode/alias inserts are
 * conflict-tolerant, so importing the same product twice is a no-op.
 */
export async function importOffFood(off: OffFood): Promise<string> {
  const foodId = uuidv5(`off:${off.barcode}`, OFF_NAMESPACE);
  const displayName = off.brand ? `${off.nameEs} (${off.brand})` : off.nameEs;

  await adminDb.transaction(async (tx) => {
    await tx.execute(sql`
      insert into foods
        (id, name_en, name_es, source, fdc_id, barcode, calories, protein, carbs,
         fat, fiber, sugar, sodium, serving_size, serving_unit)
      values
        (${foodId}, ${off.nameEn}, ${displayName}, 'off', null, ${off.barcode},
         ${off.calories}, ${off.protein}, ${off.carbs}, ${off.fat}, ${off.fiber},
         ${off.sugar}, ${off.sodium}, 100, 'g')
      on conflict (id) do update set
        name_en = excluded.name_en,
        name_es = excluded.name_es,
        calories = excluded.calories,
        protein = excluded.protein,
        carbs = excluded.carbs,
        fat = excluded.fat,
        fiber = excluded.fiber,
        sugar = excluded.sugar,
        sodium = excluded.sodium,
        updated_at = now()
    `);

    await tx.execute(sql`
      insert into barcodes (id, food_id, barcode, source)
      values (${uuidv5(`bc:${off.barcode}`, OFF_NAMESPACE)}, ${foodId}, ${off.barcode}, 'off')
      on conflict (barcode) do nothing
    `);

    await tx.execute(sql`
      insert into food_aliases (id, food_id, alias_text, locale, confidence)
      values (${uuidv5(`alias:${off.barcode}`, OFF_NAMESPACE)}, ${foodId}, ${off.nameEs}, 'es', 0.90)
      on conflict (food_id, alias_text, locale) do nothing
    `);
  });

  return foodId;
}
