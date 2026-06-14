/**
 * Bulk-import a curated slice of Open Food Facts into the catalog.
 *
 * Why a curated subset (CLAUDE.md §3 cost constraint): OFF's full database is
 * ~4M products / multi-GB and will not fit Supabase's 500MB free tier. OFF's own
 * reuse policy also states "1 API call = 1 real scan" and that scraping the live
 * API gets blocked, pointing reusers to the nightly bulk exports instead. So we
 * take the official Parquet dump, filter to products sold in Spain + LATAM that
 * have real nutrition, rank by popularity, and import the top N. This gives
 * instant, offline (PWA), and fully policy-compliant name search; the live API
 * is then used only for one-off barcode lookups (1 call = 1 scan).
 *
 * Data is © Open Food Facts contributors, under the Open Database License (ODbL).
 *
 * Flow:
 *   1. Read the LOCAL parquet (download it first, see README) with DuckDB.
 *   2. Filter + rank + cap, extracting per-100g macros from the nested
 *      `nutriments` array.
 *   3. Upsert into foods / food_aliases / barcodes in batches, with the same
 *      deterministic uuidv5(barcode) ids the runtime importer uses, so bulk and
 *      on-demand imports never duplicate a product.
 *
 * Usage:
 *   pnpm tsx scripts/import-off-bulk.ts            # default cap (30k)
 *   pnpm tsx scripts/import-off-bulk.ts --limit 50000
 *   pnpm tsx scripts/import-off-bulk.ts --dry-run  # filter + report, no DB write
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';
import duckdb from 'duckdb';
import postgres from 'postgres';
import { v5 as uuidv5 } from 'uuid';

config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PARQUET_PATH = path.resolve(__dirname, '..', 'data', 'off', 'food.parquet');

/** Same namespace as src/repositories/foods.repo.ts so ids match the runtime importer. */
const OFF_NAMESPACE = 'b6e0f9a2-3c4d-4e5f-8a9b-0c1d2e3f4a5b';

const COUNTRIES = [
  'en:spain', 'en:mexico', 'en:colombia', 'en:argentina', 'en:dominican-republic',
  'en:chile', 'en:peru', 'en:venezuela', 'en:ecuador', 'en:guatemala', 'en:costa-rica',
  'en:uruguay', 'en:bolivia', 'en:paraguay', 'en:panama', 'en:honduras', 'en:el-salvador',
  'en:nicaragua', 'en:puerto-rico', 'en:cuba',
];

interface OffRow {
  code: string;
  name_es: string | null;
  name_en: string | null;
  brand: string | null;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
  salt: number | null;
}

function all(db: duckdb.Database, sql: string): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => (err ? reject(err) : resolve(rows as Record<string, unknown>[])));
  });
}

function nutrient(name: string): string {
  return `try_cast(list_filter(nutriments, n -> n.name = '${name}')[1]['100g'] AS DOUBLE)`;
}

async function extractRows(limit: number): Promise<OffRow[]> {
  const db = new duckdb.Database(':memory:');
  const arr = `[${COUNTRIES.map((c) => `'${c}'`).join(',')}]`;
  const url = PARQUET_PATH.replace(/\\/g, '/');

  const sql = `
    WITH src AS (
      SELECT
        code,
        coalesce(
          list_filter(product_name, x -> x.lang = 'es')[1].text,
          list_filter(product_name, x -> x.lang = 'main')[1].text,
          product_name[1].text
        ) AS name_es,
        coalesce(
          list_filter(product_name, x -> x.lang = 'en')[1].text,
          list_filter(product_name, x -> x.lang = 'main')[1].text,
          product_name[1].text
        ) AS name_en,
        brands AS brand,
        ${nutrient('energy-kcal')} AS kcal,
        ${nutrient('proteins')} AS protein,
        ${nutrient('carbohydrates')} AS carbs,
        ${nutrient('fat')} AS fat,
        ${nutrient('fiber')} AS fiber,
        ${nutrient('sugars')} AS sugar,
        ${nutrient('sodium')} AS sodium,
        ${nutrient('salt')} AS salt,
        popularity_key
      FROM read_parquet('${url}')
      WHERE list_has_any(countries_tags, ${arr})
        AND product_name IS NOT NULL
        AND no_nutrition_data IS NOT TRUE
        AND obsolete IS NOT TRUE
    )
    SELECT * FROM src
    WHERE name_es IS NOT NULL AND length(trim(name_es)) BETWEEN 2 AND 120
      AND kcal IS NOT NULL AND kcal >= 0 AND kcal <= 1000
      AND protein IS NOT NULL AND carbs IS NOT NULL AND fat IS NOT NULL
      AND protein BETWEEN 0 AND 100 AND carbs BETWEEN 0 AND 100 AND fat BETWEEN 0 AND 100
    ORDER BY popularity_key DESC NULLS LAST
    LIMIT ${limit}
  `;

  const rows = await all(db, sql);
  return rows.map((r) => ({
    code: String(r.code),
    name_es: r.name_es as string | null,
    name_en: r.name_en as string | null,
    brand: (r.brand as string | null) || null,
    kcal: r.kcal as number | null,
    protein: r.protein as number | null,
    carbs: r.carbs as number | null,
    fat: r.fat as number | null,
    fiber: r.fiber as number | null,
    sugar: r.sugar as number | null,
    sodium: r.sodium as number | null,
    salt: r.salt as number | null,
  }));
}

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}
function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
function clean(name: string): string {
  // OFF names can carry control bytes (incl. NUL) and lone surrogates that
  // Postgres rejects as invalid UTF-8. Filter by code point (no fragile control
  // literals), then collapse whitespace.
  let out = '';
  for (const ch of name) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 0x20 || c === 0x7f) {
      out += ' ';
    } else if (c >= 0xd800 && c <= 0xdfff) {
      // skip lone surrogates
    } else {
      out += ch;
    }
  }
  return out.replace(/\s+/g, ' ').trim();
}

interface FoodInsert {
  id: string;
  name_en: string;
  name_es: string;
  source: 'off';
  fdc_id: null;
  barcode: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
  serving_size: number;
  serving_unit: string;
}

function toInsert(r: OffRow): FoodInsert | null {
  const code = r.code.replace(/\D/g, '');
  if (code.length < 8 || code.length > 14) return null;
  const nameEs = clean(r.name_es ?? '');
  if (!nameEs) return null;
  const displayName = r.brand ? `${nameEs} (${clean(r.brand).split(',')[0]})` : nameEs;
  // OFF sodium is g/100g; catalog stores mg/100g. Fall back to salt/2.5 -> sodium.
  const sodiumMg =
    r.sodium != null ? r.sodium * 1000 : r.salt != null ? (r.salt / 2.5) * 1000 : null;

  return {
    id: uuidv5(`off:${code}`, OFF_NAMESPACE),
    name_en: clean(r.name_en ?? nameEs).slice(0, 160),
    name_es: displayName.slice(0, 160),
    source: 'off',
    fdc_id: null,
    barcode: code,
    calories: round2(r.kcal ?? 0),
    protein: round2(r.protein ?? 0),
    carbs: round2(r.carbs ?? 0),
    fat: round2(r.fat ?? 0),
    // Clamp optional nutrients to physical per-100g bounds. OFF has occasional
    // corrupt rows whose sodium (mg) would overflow numeric(8,2).
    fiber: r.fiber == null ? null : round2(clamp(r.fiber, 0, 100)),
    sugar: r.sugar == null ? null : round2(clamp(r.sugar, 0, 100)),
    sodium: sodiumMg == null ? null : round2(clamp(sodiumMg, 0, 100000)),
    serving_size: 100,
    serving_unit: 'g',
  };
}

async function upsert(sql: postgres.Sql, foods: FoodInsert[]): Promise<void> {
  const CHUNK = 1000;
  for (let i = 0; i < foods.length; i += CHUNK) {
    const batch = foods.slice(i, i + CHUNK);

    await sql`
      insert into public.foods ${sql(
        batch,
        'id', 'name_en', 'name_es', 'source', 'fdc_id', 'barcode', 'calories',
        'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium', 'serving_size', 'serving_unit',
      )}
      on conflict (id) do update set
        name_en = excluded.name_en, name_es = excluded.name_es,
        calories = excluded.calories, protein = excluded.protein,
        carbs = excluded.carbs, fat = excluded.fat, fiber = excluded.fiber,
        sugar = excluded.sugar, sodium = excluded.sodium, updated_at = now()
    `;

    const aliases = batch.map((f) => ({
      id: uuidv5(`alias:${f.barcode}`, OFF_NAMESPACE),
      food_id: f.id,
      alias_text: f.name_es,
      locale: 'es',
      confidence: 0.9,
    }));
    await sql`
      insert into public.food_aliases ${sql(aliases, 'id', 'food_id', 'alias_text', 'locale', 'confidence')}
      on conflict (food_id, alias_text, locale) do nothing
    `;

    const barcodes = batch.map((f) => ({
      id: uuidv5(`bc:${f.barcode}`, OFF_NAMESPACE),
      food_id: f.id,
      barcode: f.barcode,
      source: 'off' as const,
    }));
    await sql`
      insert into public.barcodes ${sql(barcodes, 'id', 'food_id', 'barcode', 'source')}
      on conflict (barcode) do nothing
    `;

    console.info(`  upserted ${Math.min(i + CHUNK, foods.length)}/${foods.length}`);
  }
}

async function main(): Promise<void> {
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : 30000;
  const dryRun = process.argv.includes('--dry-run');

  console.info(`Reading parquet, filtering Spain+LATAM, top ${limit} by popularity...`);
  const raw = await extractRows(limit);
  console.info(`Extracted ${raw.length} candidate rows.`);

  const seen = new Set<string>();
  const foods: FoodInsert[] = [];
  for (const r of raw) {
    const f = toInsert(r);
    if (!f || seen.has(f.barcode)) continue;
    seen.add(f.barcode);
    foods.push(f);
  }
  console.info(`Prepared ${foods.length} unique products to import.`);
  console.info('Sample:', foods.slice(0, 5).map((f) => `${f.barcode} ${f.name_es} ${f.calories}kcal`));

  if (dryRun) {
    console.info('Dry run: no database writes.');
    return;
  }

  const dbUrl = process.env.DATABASE_URL_DIRECT;
  if (!dbUrl) throw new Error('DATABASE_URL_DIRECT is required');
  const sql = postgres(dbUrl, { max: 1, prepare: false, onnotice: () => {} });
  try {
    await upsert(sql, foods);
    console.info(`Done. Imported ${foods.length} OFF products.`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err: unknown) => {
  console.error('OFF bulk import failed:', err);
  process.exit(1);
});
