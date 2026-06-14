/**
 * Curated catalog seed for the LATAM/Spain diet.
 *
 * Two sources, per CLAUDE.md §4:
 *   - USDA FoodData Central - nutrition for whole/unbranded foods (per 100 g).
 *   - Open Food Facts        - packaged products by barcode (per 100 g + EAN).
 *
 * Each entry carries the colloquial Spanish names that seed `food_aliases`, so
 * "habichuelas", "frijoles" and "porotos" all resolve to the same beans row.
 * The list is intentionally high-signal rather than exhaustive; it extends by
 * appending entries here and re-running `pnpm db:seed`.
 */

export interface UsdaSeedItem {
  key: string;
  nameEs: string;
  nameEn: string;
  /** USDA FDC search query. The best Foundation/SR-Legacy match is taken. */
  query: string;
  aliases: string[];
  /** Optional human-friendly serving used as the default portion in the UI. */
  defaultServing?: { label: string; grams: number };
}

export interface OffSeedItem {
  key: string;
  nameEs: string;
  nameEn: string;
  /** EAN/UPC barcode looked up against Open Food Facts. */
  barcode: string;
  aliases: string[];
}

/** Coarse taxonomy mirrored by foods.category (migration 0013). */
export type FoodCategory =
  | 'grain'
  | 'legume'
  | 'protein'
  | 'dairy'
  | 'vegetable'
  | 'fruit'
  | 'fat'
  | 'other';

/**
 * Category for every curated item, keyed by `key`. This is the source of truth
 * the seed writes into foods.category; migration 0013 carries the same mapping
 * as a one-time backfill keyed on the deterministic ids. Bulk-imported OFF
 * products that are not listed here default to 'other'.
 */
export const CATEGORY_BY_KEY: Readonly<Record<string, FoodCategory>> = {
  white_rice_cooked: 'grain',
  brown_rice_cooked: 'grain',
  oats: 'grain',
  whole_wheat_bread: 'grain',
  cassava: 'grain',
  sweet_potato: 'grain',
  potato: 'grain',
  plantain_ripe: 'grain',
  plantain_green: 'grain',
  corn_tortilla: 'grain',
  pasta_cooked: 'grain',
  red_beans: 'legume',
  black_beans: 'legume',
  chickpeas: 'legume',
  lentils: 'legume',
  chicken_breast: 'protein',
  chicken_thigh: 'protein',
  ground_beef: 'protein',
  pork_loin: 'protein',
  egg: 'protein',
  tuna_water: 'protein',
  salmon: 'protein',
  tilapia: 'protein',
  whole_milk: 'dairy',
  plain_yogurt: 'dairy',
  fresh_cheese: 'dairy',
  butter: 'fat',
  olive_oil: 'fat',
  peanut_butter: 'fat',
  almonds: 'fat',
  avocado: 'fat',
  tomato: 'vegetable',
  lettuce: 'vegetable',
  onion: 'vegetable',
  garlic: 'vegetable',
  carrot: 'vegetable',
  broccoli: 'vegetable',
  bell_pepper: 'vegetable',
  banana: 'fruit',
  apple: 'fruit',
  orange: 'fruit',
  papaya: 'fruit',
  pineapple: 'fruit',
  mango: 'fruit',
  off_nutella: 'other',
  off_coca_cola: 'other',
  off_oreo: 'other',
};

export const USDA_SEED: readonly UsdaSeedItem[] = [
  // ── Grains & starches ──────────────────────────────────────────────────────
  {
    key: 'white_rice_cooked',
    nameEs: 'Arroz blanco cocido',
    nameEn: 'White rice, cooked',
    query: 'rice white cooked unenriched',
    aliases: ['arroz', 'arroz blanco', 'arroz cocido'],
    defaultServing: { label: 'taza', grams: 158 },
  },
  {
    key: 'brown_rice_cooked',
    nameEs: 'Arroz integral cocido',
    nameEn: 'Brown rice, cooked',
    query: 'rice brown long-grain cooked',
    aliases: ['arroz integral', 'arroz moreno'],
    defaultServing: { label: 'taza', grams: 195 },
  },
  {
    key: 'oats',
    nameEs: 'Avena en hojuelas',
    nameEn: 'Oats, rolled',
    query: 'oats rolled raw',
    aliases: ['avena', 'hojuelas de avena', 'oatmeal'],
    defaultServing: { label: 'taza', grams: 81 },
  },
  {
    key: 'whole_wheat_bread',
    nameEs: 'Pan integral',
    nameEn: 'Whole wheat bread',
    query: 'bread whole wheat commercially prepared',
    aliases: ['pan integral', 'pan de trigo integral'],
    defaultServing: { label: 'rebanada', grams: 28 },
  },
  {
    key: 'cassava',
    nameEs: 'Yuca',
    nameEn: 'Cassava, raw',
    query: 'cassava raw',
    aliases: ['yuca', 'mandioca', 'casava'],
    defaultServing: { label: 'taza', grams: 206 },
  },
  {
    key: 'sweet_potato',
    nameEs: 'Batata',
    nameEn: 'Sweet potato, raw',
    query: 'sweet potato raw',
    aliases: ['batata', 'boniato', 'camote', 'papa dulce'],
    defaultServing: { label: 'unidad mediana', grams: 130 },
  },
  {
    key: 'potato',
    nameEs: 'Papa',
    nameEn: 'Potato, raw',
    query: 'potatoes flesh and skin raw',
    aliases: ['papa', 'patata'],
    defaultServing: { label: 'unidad mediana', grams: 173 },
  },
  {
    key: 'plantain_ripe',
    nameEs: 'Plátano maduro',
    nameEn: 'Plantain, ripe',
    query: 'plantains yellow raw',
    aliases: ['platano maduro', 'maduro', 'platano'],
    defaultServing: { label: 'unidad mediana', grams: 179 },
  },
  {
    key: 'plantain_green',
    nameEs: 'Plátano verde',
    nameEn: 'Plantain, green',
    query: 'plantains green raw',
    aliases: ['platano verde', 'verde', 'tostones'],
    defaultServing: { label: 'unidad mediana', grams: 179 },
  },
  {
    key: 'corn_tortilla',
    nameEs: 'Tortilla de maíz',
    nameEn: 'Corn tortilla',
    query: 'tortillas ready-to-bake or -fry corn',
    aliases: ['tortilla', 'tortilla de maiz'],
    defaultServing: { label: 'unidad', grams: 26 },
  },
  {
    key: 'pasta_cooked',
    nameEs: 'Pasta cocida',
    nameEn: 'Pasta, cooked',
    query: 'pasta cooked enriched',
    aliases: ['pasta', 'fideos', 'espagueti', 'macarrones'],
    defaultServing: { label: 'taza', grams: 124 },
  },

  // ── Legumes ────────────────────────────────────────────────────────────────
  {
    key: 'red_beans',
    nameEs: 'Habichuelas rojas',
    nameEn: 'Red kidney beans, cooked',
    query: 'kidney beans red mature seeds cooked boiled',
    aliases: ['habichuelas', 'habichuelas rojas', 'frijoles rojos', 'porotos rojos'],
    defaultServing: { label: 'taza', grams: 177 },
  },
  {
    key: 'black_beans',
    nameEs: 'Frijoles negros',
    nameEn: 'Black beans, cooked',
    query: 'black beans mature seeds cooked boiled',
    aliases: ['frijoles negros', 'habichuelas negras', 'caraotas', 'porotos negros'],
    defaultServing: { label: 'taza', grams: 172 },
  },
  {
    key: 'chickpeas',
    nameEs: 'Garbanzos',
    nameEn: 'Chickpeas, cooked',
    query: 'chickpeas garbanzo cooked boiled',
    aliases: ['garbanzos', 'garbanzo'],
    defaultServing: { label: 'taza', grams: 164 },
  },
  {
    key: 'lentils',
    nameEs: 'Lentejas',
    nameEn: 'Lentils, cooked',
    query: 'lentils mature seeds cooked boiled',
    aliases: ['lentejas', 'lenteja'],
    defaultServing: { label: 'taza', grams: 198 },
  },

  // ── Proteins ───────────────────────────────────────────────────────────────
  {
    key: 'chicken_breast',
    nameEs: 'Pechuga de pollo',
    nameEn: 'Chicken breast, cooked',
    query: 'chicken breast meat only cooked roasted',
    aliases: ['pollo', 'pechuga', 'pechuga de pollo', 'pollo a la plancha'],
    defaultServing: { label: 'porción', grams: 100 },
  },
  {
    key: 'chicken_thigh',
    nameEs: 'Muslo de pollo',
    nameEn: 'Chicken thigh, cooked',
    query: 'chicken thigh meat only cooked roasted',
    aliases: ['muslo de pollo', 'muslo', 'pierna de pollo'],
    defaultServing: { label: 'porción', grams: 100 },
  },
  {
    key: 'ground_beef',
    nameEs: 'Carne molida de res',
    nameEn: 'Ground beef, cooked',
    query: 'ground beef 80% lean meat 20% fat cooked pan-broiled',
    aliases: ['carne molida', 'carne de res', 'carne picada', 'molida de res'],
    defaultServing: { label: 'porción', grams: 100 },
  },
  {
    key: 'pork_loin',
    nameEs: 'Lomo de cerdo',
    nameEn: 'Pork loin, cooked',
    query: 'pork loin cooked roasted',
    aliases: ['cerdo', 'lomo de cerdo', 'chuleta'],
    defaultServing: { label: 'porción', grams: 100 },
  },
  {
    key: 'egg',
    nameEs: 'Huevo entero',
    nameEn: 'Egg, whole',
    query: 'egg whole raw fresh',
    aliases: ['huevo', 'huevos', 'huevo entero'],
    defaultServing: { label: 'unidad', grams: 50 },
  },
  {
    key: 'tuna_water',
    nameEs: 'Atún en agua',
    nameEn: 'Tuna, canned in water',
    query: 'fish tuna light canned in water drained',
    aliases: ['atun', 'atun en agua', 'atun enlatado'],
    defaultServing: { label: 'lata', grams: 142 },
  },
  {
    key: 'salmon',
    nameEs: 'Salmón',
    nameEn: 'Salmon, cooked',
    query: 'fish salmon atlantic cooked dry heat',
    aliases: ['salmon'],
    defaultServing: { label: 'porción', grams: 100 },
  },
  {
    key: 'tilapia',
    nameEs: 'Tilapia',
    nameEn: 'Tilapia, cooked',
    query: 'fish tilapia cooked dry heat',
    aliases: ['tilapia', 'pescado'],
    defaultServing: { label: 'porción', grams: 100 },
  },

  // ── Dairy ──────────────────────────────────────────────────────────────────
  {
    key: 'whole_milk',
    nameEs: 'Leche entera',
    nameEn: 'Whole milk',
    query: 'milk whole 3.25% milkfat',
    aliases: ['leche', 'leche entera'],
    defaultServing: { label: 'taza', grams: 244 },
  },
  {
    key: 'plain_yogurt',
    nameEs: 'Yogurt natural',
    nameEn: 'Plain yogurt',
    query: 'yogurt plain whole milk',
    aliases: ['yogurt', 'yogur', 'yogurt natural'],
    defaultServing: { label: 'taza', grams: 245 },
  },
  {
    key: 'fresh_cheese',
    nameEs: 'Queso fresco',
    nameEn: 'Fresh cheese (queso fresco)',
    query: 'cheese queso fresco',
    aliases: ['queso fresco', 'queso blanco', 'queso'],
    defaultServing: { label: 'porción', grams: 30 },
  },
  {
    key: 'butter',
    nameEs: 'Mantequilla',
    nameEn: 'Butter',
    query: 'butter salted',
    aliases: ['mantequilla', 'manteca'],
    defaultServing: { label: 'cucharada', grams: 14 },
  },

  // ── Vegetables ─────────────────────────────────────────────────────────────
  {
    key: 'tomato',
    nameEs: 'Tomate',
    nameEn: 'Tomato, raw',
    query: 'tomatoes red ripe raw',
    aliases: ['tomate', 'jitomate'],
    defaultServing: { label: 'unidad mediana', grams: 123 },
  },
  {
    key: 'lettuce',
    nameEs: 'Lechuga',
    nameEn: 'Lettuce, raw',
    query: 'lettuce romaine raw',
    aliases: ['lechuga'],
    defaultServing: { label: 'taza', grams: 47 },
  },
  {
    key: 'onion',
    nameEs: 'Cebolla',
    nameEn: 'Onion, raw',
    query: 'onions raw',
    aliases: ['cebolla'],
    defaultServing: { label: 'unidad mediana', grams: 110 },
  },
  {
    key: 'garlic',
    nameEs: 'Ajo',
    nameEn: 'Garlic, raw',
    query: 'garlic raw',
    aliases: ['ajo', 'diente de ajo'],
    defaultServing: { label: 'diente', grams: 3 },
  },
  {
    key: 'carrot',
    nameEs: 'Zanahoria',
    nameEn: 'Carrot, raw',
    query: 'carrots raw',
    aliases: ['zanahoria'],
    defaultServing: { label: 'unidad mediana', grams: 61 },
  },
  {
    key: 'broccoli',
    nameEs: 'Brócoli',
    nameEn: 'Broccoli, raw',
    query: 'broccoli raw',
    aliases: ['brocoli'],
    defaultServing: { label: 'taza', grams: 91 },
  },
  {
    key: 'bell_pepper',
    nameEs: 'Pimiento',
    nameEn: 'Bell pepper, raw',
    query: 'peppers sweet red raw',
    aliases: ['pimiento', 'pimenton', 'aji', 'morron'],
    defaultServing: { label: 'unidad mediana', grams: 119 },
  },
  {
    key: 'avocado',
    nameEs: 'Aguacate',
    nameEn: 'Avocado, raw',
    query: 'avocados raw all commercial varieties',
    aliases: ['aguacate', 'palta'],
    defaultServing: { label: 'unidad', grams: 150 },
  },

  // ── Fruits ─────────────────────────────────────────────────────────────────
  {
    key: 'banana',
    nameEs: 'Banana',
    nameEn: 'Banana, raw',
    query: 'bananas raw',
    aliases: ['banana', 'guineo', 'cambur'],
    defaultServing: { label: 'unidad mediana', grams: 118 },
  },
  {
    key: 'apple',
    nameEs: 'Manzana',
    nameEn: 'Apple, raw',
    query: 'apples raw with skin',
    aliases: ['manzana'],
    defaultServing: { label: 'unidad mediana', grams: 182 },
  },
  {
    key: 'orange',
    nameEs: 'Naranja',
    nameEn: 'Orange, raw',
    query: 'oranges raw all commercial varieties',
    aliases: ['naranja', 'china'],
    defaultServing: { label: 'unidad mediana', grams: 131 },
  },
  {
    key: 'papaya',
    nameEs: 'Papaya',
    nameEn: 'Papaya, raw',
    query: 'papayas raw',
    aliases: ['papaya', 'lechosa', 'fruta bomba'],
    defaultServing: { label: 'taza', grams: 145 },
  },
  {
    key: 'pineapple',
    nameEs: 'Piña',
    nameEn: 'Pineapple, raw',
    query: 'pineapple raw all varieties',
    aliases: ['pina', 'ananas'],
    defaultServing: { label: 'taza', grams: 165 },
  },
  {
    key: 'mango',
    nameEs: 'Mango',
    nameEn: 'Mango, raw',
    query: 'mangos raw',
    aliases: ['mango'],
    defaultServing: { label: 'unidad', grams: 200 },
  },

  // ── Fats & others ──────────────────────────────────────────────────────────
  {
    key: 'olive_oil',
    nameEs: 'Aceite de oliva',
    nameEn: 'Olive oil',
    query: 'oil olive salad or cooking',
    aliases: ['aceite de oliva', 'aceite'],
    defaultServing: { label: 'cucharada', grams: 14 },
  },
  {
    key: 'peanut_butter',
    nameEs: 'Mantequilla de maní',
    nameEn: 'Peanut butter',
    query: 'peanut butter smooth style',
    aliases: ['mantequilla de mani', 'crema de cacahuate', 'crema de mani'],
    defaultServing: { label: 'cucharada', grams: 16 },
  },
  {
    key: 'almonds',
    nameEs: 'Almendras',
    nameEn: 'Almonds',
    query: 'nuts almonds',
    aliases: ['almendras', 'almendra'],
    defaultServing: { label: 'puñado', grams: 28 },
  },
] as const;

/**
 * Packaged products sourced from Open Food Facts by barcode. These demonstrate
 * the barcode path the scanner (Sprint 4) will use; nutrition is per 100 g.
 * Barcodes are widely-distributed staples likely to exist in OFF.
 */
export const OFF_SEED: readonly OffSeedItem[] = [
  {
    key: 'off_nutella',
    nameEs: 'Nutella',
    nameEn: 'Nutella hazelnut spread',
    barcode: '3017620422003',
    aliases: ['nutella', 'crema de avellana'],
  },
  {
    key: 'off_coca_cola',
    nameEs: 'Coca-Cola',
    nameEn: 'Coca-Cola',
    barcode: '5449000000996',
    aliases: ['coca cola', 'coca', 'refresco de cola', 'gaseosa'],
  },
  {
    key: 'off_oreo',
    nameEs: 'Galletas Oreo',
    nameEn: 'Oreo cookies',
    barcode: '7622210449283',
    aliases: ['oreo', 'galletas oreo'],
  },
];
