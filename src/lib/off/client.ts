import 'server-only';

import { z } from 'zod';

/**
 * Open Food Facts client - live access to OFF's full (~4M product) catalog.
 *
 * Per CLAUDE.md §3/§4 OFF is free and key-less. A curated slice of the bulk
 * dump is imported into the local catalog (see scripts/import-off-bulk.ts), so
 * this live client handles only the long tail: per-product barcode lookups and
 * occasional user-initiated name searches. OFF's reuse policy (1 call = 1 real
 * scan; scraping is blocked) is respected by keeping this low-volume and
 * user-driven, never harvesting.
 *
 * Two endpoints, both public and maintained:
 *   - Product by barcode: api/v2/product/{ean}.json        (per-product, 1 scan)
 *   - Name search:        search.openfoodfacts.org/search  (Search-a-licious)
 *
 * All nutrition is normalized to per-100 g to match the `foods` convention.
 */

const PRODUCT_ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product';
// Search-a-licious: OFF's maintained, sanctioned full-text search service. Used
// only for low-volume, user-initiated name searches (the deprecated cgi/search.pl
// is avoided). Barcode lookups stay on the per-product v2 API (1 call = 1 scan).
const SEARCH_ENDPOINT = 'https://search.openfoodfacts.org/search';
const USER_AGENT = 'NutriFlow/0.1 (https://github.com/oscarjnz/nutriflow)';
const REQUEST_TIMEOUT_MS = 6000;
const NUTRIMENT_FIELDS = 'code,product_name,product_name_es,product_name_en,brands,nutriments';

/** Normalized OFF product, macros per 100 g (same shape the catalog stores). */
export interface OffFood {
  barcode: string;
  nameEs: string;
  nameEn: string;
  brand: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
}

// ── Wire shapes ──────────────────────────────────────────────────────────────
//
// OFF is community-maintained and loosely typed: numeric fields arrive as
// numbers, numeric strings, or are missing entirely. We validate only the
// envelope with Zod and read nutriment values through a tolerant coercion.

const nutrimentsSchema = z.record(z.unknown());

const productSchema = z.object({
  code: z.union([z.string(), z.number()]).optional(),
  product_name: z.string().optional(),
  product_name_es: z.string().optional(),
  product_name_en: z.string().optional(),
  brands: z.string().optional(),
  nutriments: nutrimentsSchema.optional(),
});
type RawProduct = z.infer<typeof productSchema>;

const productResponseSchema = z.object({
  status: z.number().optional(),
  product: productSchema.optional(),
});

const searchResponseSchema = z.object({
  hits: z.array(productSchema).optional(),
});

// ── Public API ───────────────────────────────────────────────────────────────

/** Look up a single product by EAN/UPC. Returns null if OFF has no usable row. */
export async function lookupOffBarcode(barcode: string): Promise<OffFood | null> {
  const url = new URL(`${PRODUCT_ENDPOINT}/${encodeURIComponent(barcode)}.json`);
  url.searchParams.set('fields', NUTRIMENT_FIELDS);

  const json = await fetchJson(url);
  const parsed = productResponseSchema.safeParse(json);
  if (!parsed.success || parsed.data.status !== 1 || !parsed.data.product) {
    return null;
  }
  return normalize(parsed.data.product, barcode);
}

/**
 * Full-text product search against OFF (Spanish subdomain for es-ranked names).
 * Returns only products with enough nutrition to log; capped at `limit`.
 */
export async function searchOffProducts(query: string, limit = 8): Promise<OffFood[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set('q', q);
  url.searchParams.set('langs', 'es');
  url.searchParams.set('page_size', String(Math.min(limit * 2, 30)));
  url.searchParams.set('fields', NUTRIMENT_FIELDS);

  const json = await fetchJson(url);
  const parsed = searchResponseSchema.safeParse(json);
  if (!parsed.success || !parsed.data.hits) return [];

  const out: OffFood[] = [];
  const seen = new Set<string>();
  for (const raw of parsed.data.hits) {
    const code = typeof raw.code === 'number' ? String(raw.code) : raw.code;
    if (!code || seen.has(code)) continue;
    const food = normalize(raw, code);
    if (food) {
      seen.add(code);
      out.push(food);
      if (out.length >= limit) break;
    }
  }
  return out;
}

// ── Internals ────────────────────────────────────────────────────────────────

async function fetchJson(url: URL): Promise<unknown> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Open Food Facts ${res.status} ${res.statusText} for ${url.pathname}`);
  }
  return res.json();
}

/** Read a nutriment that OFF may encode as number, numeric string, or absence. */
function num(nutriments: Record<string, unknown> | undefined, key: string): number | null {
  if (!nutriments) return null;
  const v = nutriments[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function pickName(p: RawProduct): string | null {
  const name = p.product_name_es?.trim() || p.product_name?.trim() || p.product_name_en?.trim();
  return name && name.length > 0 ? name : null;
}

/**
 * Map a raw OFF product to our per-100g shape. Returns null when the product is
 * unloggable: no name, or no nutrition (neither energy nor any macro), which is
 * common for incomplete community entries.
 */
function normalize(p: RawProduct, barcode: string): OffFood | null {
  const name = pickName(p);
  if (!name) return null;

  const n = p.nutriments;
  const protein = num(n, 'proteins_100g') ?? 0;
  const carbs = num(n, 'carbohydrates_100g') ?? 0;
  const fat = num(n, 'fat_100g') ?? 0;
  const energy = num(n, 'energy-kcal_100g');

  if (energy === null && protein === 0 && carbs === 0 && fat === 0) {
    return null;
  }
  const calories = energy ?? round2(protein * 4 + carbs * 4 + fat * 9);
  const sodiumG = num(n, 'sodium_100g');
  const brand = p.brands?.split(',')[0]?.trim() || null;

  return {
    barcode,
    nameEs: name,
    nameEn: p.product_name_en?.trim() || name,
    brand,
    calories: round2(calories),
    protein: round2(protein),
    carbs: round2(carbs),
    fat: round2(fat),
    fiber: numOrNull(num(n, 'fiber_100g')),
    sugar: numOrNull(num(n, 'sugars_100g')),
    // OFF reports sodium in g/100g; the catalog stores mg/100g (matches USDA).
    sodium: sodiumG === null ? null : round2(sodiumG * 1000),
  };
}

function numOrNull(value: number | null): number | null {
  return value === null ? null : round2(value);
}
