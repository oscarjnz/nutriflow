/**
 * Seed the food catalog from USDA FoodData Central + Open Food Facts.
 *
 * Flow:
 *   1. Resolve nutrition for every curated item (USDA by search, OFF by
 *      barcode). Results are written to `supabase/seed/catalog-snapshot.json`.
 *   2. On subsequent runs the snapshot is reused (no API calls) unless
 *      `--refresh` is passed. This keeps seeding reproducible and offline/CI
 *      friendly.
 *   3. Upsert into `foods`, `food_aliases`, `barcodes`, `food_servings` using
 *      deterministic UUIDv5 ids derived from each item key, so re-running is
 *      fully idempotent.
 *
 * Usage:
 *   pnpm db:seed            # reuse snapshot if present, else fetch
 *   pnpm db:seed --refresh  # always re-fetch from the APIs
 *
 * All macro values are stored per 100 g (CLAUDE.md catalog convention).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';
import postgres from 'postgres';
import { v5 as uuidv5 } from 'uuid';

import { OFF_SEED, type OffSeedItem, USDA_SEED, type UsdaSeedItem } from './seed-data';

config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SNAPSHOT_PATH = path.resolve(__dirname, '..', 'supabase', 'seed', 'catalog-snapshot.json');

/** Fixed namespace so uuidv5(key) is stable across machines and runs. */
const SEED_NAMESPACE = 'b6e0f9a2-3c4d-4e5f-8a9b-0c1d2e3f4a5b';

interface ResolvedFood {
  key: string;
  source: 'usda' | 'off';
  nameEs: string;
  nameEn: string;
  fdcId: number | null;
  barcode: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
  servingSize: number;
  servingUnit: string;
  aliases: string[];
  defaultServing: { label: string; grams: number } | null;
}

// ── USDA ─────────────────────────────────────────────────────────────────────

const USDA_NUTRIENT = {
  energy: 1008,
  protein: 1003,
  carbs: 1005,
  fat: 1004,
  fiber: 1079,
  sugarPrimary: 2000,
  sugarFallback: 1063,
  sodium: 1093,
} as const;

interface UsdaNutrient {
  nutrientId: number;
  value: number;
}
interface UsdaFood {
  fdcId: number;
  description: string;
  foodNutrients: UsdaNutrient[];
}

function pickNutrient(nutrients: UsdaNutrient[], id: number): number | null {
  const n = nutrients.find((x) => x.nutrientId === id);
  return n && typeof n.value === 'number' ? n.value : null;
}

async function resolveUsda(item: UsdaSeedItem, apiKey: string): Promise<ResolvedFood> {
  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('query', item.query);
  url.searchParams.set('dataType', 'Foundation,SR Legacy');
  url.searchParams.set('pageSize', '1');

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`USDA search failed for "${item.key}": ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as { foods?: UsdaFood[] };
  const food = body.foods?.[0];
  if (!food) {
    throw new Error(`USDA returned no match for "${item.key}" (query: ${item.query})`);
  }

  const nutrients = food.foodNutrients;
  const energy = pickNutrient(nutrients, USDA_NUTRIENT.energy);
  const protein = pickNutrient(nutrients, USDA_NUTRIENT.protein) ?? 0;
  const carbs = pickNutrient(nutrients, USDA_NUTRIENT.carbs) ?? 0;
  const fat = pickNutrient(nutrients, USDA_NUTRIENT.fat) ?? 0;

  const calories = energy ?? round2(protein * 4 + carbs * 4 + fat * 9);

  return {
    key: item.key,
    source: 'usda',
    nameEs: item.nameEs,
    nameEn: item.nameEn,
    fdcId: food.fdcId,
    barcode: null,
    calories: round2(calories),
    protein: round2(protein),
    carbs: round2(carbs),
    fat: round2(fat),
    fiber: roundOrNull(pickNutrient(nutrients, USDA_NUTRIENT.fiber)),
    sugar: roundOrNull(
      pickNutrient(nutrients, USDA_NUTRIENT.sugarPrimary) ??
        pickNutrient(nutrients, USDA_NUTRIENT.sugarFallback),
    ),
    sodium: roundOrNull(pickNutrient(nutrients, USDA_NUTRIENT.sodium)),
    servingSize: 100,
    servingUnit: 'g',
    aliases: item.aliases,
    defaultServing: item.defaultServing ?? null,
  };
}

// ── Open Food Facts ──────────────────────────────────────────────────────────

interface OffNutriments {
  'energy-kcal_100g'?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
  fiber_100g?: number;
  sugars_100g?: number;
  sodium_100g?: number;
}
interface OffProduct {
  product_name?: string;
  nutriments?: OffNutriments;
}

async function resolveOff(item: OffSeedItem): Promise<ResolvedFood> {
  const url = new URL(`https://world.openfoodfacts.org/api/v2/product/${item.barcode}.json`);
  url.searchParams.set('fields', 'product_name,nutriments');

  const res = await fetch(url, {
    headers: { 'User-Agent': 'NutriFlow/0.1 (seed script; contact via repo)' },
  });
  if (!res.ok) {
    throw new Error(`OFF lookup failed for "${item.key}": ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as { status?: number; product?: OffProduct };
  if (body.status !== 1 || !body.product?.nutriments) {
    throw new Error(`OFF has no product for barcode ${item.barcode} ("${item.key}")`);
  }

  const n = body.product.nutriments;
  const protein = n.proteins_100g ?? 0;
  const carbs = n.carbohydrates_100g ?? 0;
  const fat = n.fat_100g ?? 0;
  const calories = n['energy-kcal_100g'] ?? round2(protein * 4 + carbs * 4 + fat * 9);

  return {
    key: item.key,
    source: 'off',
    nameEs: item.nameEs,
    nameEn: item.nameEn,
    fdcId: null,
    barcode: item.barcode,
    calories: round2(calories),
    protein: round2(protein),
    carbs: round2(carbs),
    fat: round2(fat),
    fiber: roundOrNull(n.fiber_100g ?? null),
    sugar: roundOrNull(n.sugars_100g ?? null),
    // OFF sodium is grams/100g; USDA stores mg/100g. Normalize to mg.
    sodium: roundOrNull(n.sodium_100g != null ? n.sodium_100g * 1000 : null),
    servingSize: 100,
    servingUnit: 'g',
    aliases: item.aliases,
    defaultServing: null,
  };
}

// ── Resolution + snapshot ────────────────────────────────────────────────────

async function loadSnapshot(): Promise<ResolvedFood[] | null> {
  try {
    const raw = await readFile(SNAPSHOT_PATH, 'utf-8');
    return JSON.parse(raw) as ResolvedFood[];
  } catch {
    return null;
  }
}

async function fetchAll(apiKey: string): Promise<ResolvedFood[]> {
  const resolved: ResolvedFood[] = [];

  for (const item of USDA_SEED) {
    try {
      resolved.push(await resolveUsda(item, apiKey));
      console.info(`✓ USDA ${item.key}`);
    } catch (err: unknown) {
      console.error(`✗ USDA ${item.key}:`, err instanceof Error ? err.message : err);
    }
    await sleep(150);
  }

  for (const item of OFF_SEED) {
    try {
      resolved.push(await resolveOff(item));
      console.info(`✓ OFF  ${item.key}`);
    } catch (err: unknown) {
      console.error(`✗ OFF  ${item.key}:`, err instanceof Error ? err.message : err);
    }
    await sleep(150);
  }

  return resolved;
}

// ── DB upsert ────────────────────────────────────────────────────────────────

async function upsert(sql: postgres.Sql, foods: ResolvedFood[]): Promise<void> {
  for (const f of foods) {
    const foodId = uuidv5(`food:${f.key}`, SEED_NAMESPACE);

    await sql.begin(async (tx) => {
      await tx`
        insert into public.foods
          (id, name_en, name_es, source, fdc_id, barcode, calories, protein, carbs,
           fat, fiber, sugar, sodium, serving_size, serving_unit)
        values
          (${foodId}, ${f.nameEn}, ${f.nameEs}, ${f.source}, ${f.fdcId}, ${f.barcode},
           ${f.calories}, ${f.protein}, ${f.carbs}, ${f.fat}, ${f.fiber}, ${f.sugar},
           ${f.sodium}, ${f.servingSize}, ${f.servingUnit})
        on conflict (id) do update set
          name_en = excluded.name_en,
          name_es = excluded.name_es,
          source = excluded.source,
          fdc_id = excluded.fdc_id,
          barcode = excluded.barcode,
          calories = excluded.calories,
          protein = excluded.protein,
          carbs = excluded.carbs,
          fat = excluded.fat,
          fiber = excluded.fiber,
          sugar = excluded.sugar,
          sodium = excluded.sodium,
          serving_size = excluded.serving_size,
          serving_unit = excluded.serving_unit,
          updated_at = now()
      `;

      for (const alias of f.aliases) {
        const aliasId = uuidv5(`alias:${f.key}:${alias}`, SEED_NAMESPACE);
        await tx`
          insert into public.food_aliases (id, food_id, alias_text, locale)
          values (${aliasId}, ${foodId}, ${alias}, 'es')
          on conflict (food_id, alias_text, locale) do nothing
        `;
      }

      if (f.barcode) {
        const barcodeId = uuidv5(`barcode:${f.key}:${f.barcode}`, SEED_NAMESPACE);
        await tx`
          insert into public.barcodes (id, food_id, barcode, source)
          values (${barcodeId}, ${foodId}, ${f.barcode}, ${f.source})
          on conflict (barcode) do nothing
        `;
      }

      if (f.defaultServing) {
        const servingId = uuidv5(`serving:${f.key}:${f.defaultServing.label}`, SEED_NAMESPACE);
        await tx`
          insert into public.food_servings (id, food_id, label, grams, is_default)
          values (${servingId}, ${foodId}, ${f.defaultServing.label}, ${f.defaultServing.grams}, true)
          on conflict (food_id, label) do update set
            grams = excluded.grams,
            is_default = excluded.is_default
        `;
      }
    });
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const refresh = process.argv.includes('--refresh');
  const dbUrl = process.env.DATABASE_URL_DIRECT;
  if (!dbUrl) throw new Error('DATABASE_URL_DIRECT is required');

  let foods = refresh ? null : await loadSnapshot();

  if (!foods) {
    const apiKey = process.env.FDC_API_KEY;
    if (!apiKey) throw new Error('FDC_API_KEY is required to fetch (no snapshot found)');
    console.info('Fetching from USDA + Open Food Facts...');
    foods = await fetchAll(apiKey);
    await mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
    await writeFile(SNAPSHOT_PATH, `${JSON.stringify(foods, null, 2)}\n`, 'utf-8');
    console.info(`Snapshot written: ${SNAPSHOT_PATH} (${foods.length} foods)`);
  } else {
    console.info(`Reusing snapshot: ${foods.length} foods (pass --refresh to re-fetch)`);
  }

  if (foods.length === 0) {
    throw new Error('No foods resolved; aborting before touching the database.');
  }

  const sql = postgres(dbUrl, { max: 1, prepare: false, onnotice: () => {} });
  try {
    await upsert(sql, foods);
    console.info(`Seeded ${foods.length} foods with aliases, barcodes, and servings.`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
function roundOrNull(value: number | null): number | null {
  return value === null ? null : round2(value);
}
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
