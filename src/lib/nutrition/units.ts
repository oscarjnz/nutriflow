/**
 * Deterministic unit → grams conversion.
 *
 * Per CLAUDE.md §5, no unit conversion may come from an LLM. Everything here
 * is pure, total, and exhaustively tested. The LLM may *suggest* a unit string
 * in free text ("dos cucharadas"), but the actual number of grams is resolved
 * here against the catalog's serving definitions.
 *
 * Mass units convert directly. Portion units (unit, serving, cup, tbsp, tsp)
 * are food-specific: a "cup" of rice and a "cup" of oil weigh different
 * amounts, so the caller must supply `gramsPerUnit` from `food_servings` or the
 * food's `serving_size`. Without it, the conversion fails and the caller falls
 * back to manual entry rather than guessing.
 */

export type MassUnit = 'g' | 'kg' | 'mg' | 'oz' | 'lb';
export type PortionUnit = 'unit' | 'serving' | 'cup' | 'tbsp' | 'tsp';
export type CanonicalUnit = MassUnit | PortionUnit;

const MASS_TO_GRAMS: Record<MassUnit, number> = {
  g: 1,
  kg: 1000,
  mg: 0.001,
  oz: 28.349523125,
  lb: 453.59237,
};

/**
 * Maps Spanish/English colloquial unit strings to a canonical unit. Lookup is
 * case-insensitive and accent-insensitive (see `normalizeKey`).
 */
const UNIT_ALIASES: Readonly<Record<string, CanonicalUnit>> = {
  // mass - grams
  g: 'g',
  gr: 'g',
  grs: 'g',
  gram: 'g',
  grams: 'g',
  gramo: 'g',
  gramos: 'g',
  // mass - kilograms
  kg: 'kg',
  kgs: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  kilogramo: 'kg',
  kilogramos: 'kg',
  // mass - milligrams
  mg: 'mg',
  miligramo: 'mg',
  miligramos: 'mg',
  // mass - ounces
  oz: 'oz',
  onza: 'oz',
  onzas: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  // mass - pounds
  lb: 'lb',
  lbs: 'lb',
  libra: 'lb',
  libras: 'lb',
  pound: 'lb',
  pounds: 'lb',
  // portion - discrete unit
  unit: 'unit',
  units: 'unit',
  unidad: 'unit',
  unidades: 'unit',
  pieza: 'unit',
  piezas: 'unit',
  u: 'unit',
  // portion - generic serving
  serving: 'serving',
  servings: 'serving',
  porcion: 'serving',
  porciones: 'serving',
  racion: 'serving',
  raciones: 'serving',
  // portion - cup
  cup: 'cup',
  cups: 'cup',
  taza: 'cup',
  tazas: 'cup',
  // portion - tablespoon
  tbsp: 'tbsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  cucharada: 'tbsp',
  cucharadas: 'tbsp',
  cda: 'tbsp',
  cdas: 'tbsp',
  // portion - teaspoon
  tsp: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  cucharadita: 'tsp',
  cucharaditas: 'tsp',
  cdta: 'tsp',
  cdtas: 'tsp',
};

const MASS_UNITS = new Set<CanonicalUnit>(['g', 'kg', 'mg', 'oz', 'lb']);

export type ToGramsResult =
  | { ok: true; grams: number; unit: CanonicalUnit }
  | { ok: false; reason: 'invalid_quantity' | 'unknown_unit' | 'missing_portion_grams' };

/** Strip accents and lowercase so "Cucharadás" and "cucharadas" collide. */
function normalizeKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\.$/, '');
}

/** Resolve a free-text unit string to a canonical unit, or null if unknown. */
export function normalizeUnit(raw: string): CanonicalUnit | null {
  return UNIT_ALIASES[normalizeKey(raw)] ?? null;
}

export function isMassUnit(unit: CanonicalUnit): unit is MassUnit {
  return MASS_UNITS.has(unit);
}

/**
 * Convert a (quantity, unit) pair to grams.
 *
 * @param quantity     positive number of `unit`s
 * @param rawUnit      free-text unit ("g", "taza", "unidades", ...)
 * @param gramsPerUnit grams represented by one portion unit; required for
 *                     non-mass units, ignored for mass units
 */
export function toGrams(
  quantity: number,
  rawUnit: string,
  gramsPerUnit?: number | null,
): ToGramsResult {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, reason: 'invalid_quantity' };
  }

  const unit = normalizeUnit(rawUnit);
  if (unit === null) {
    return { ok: false, reason: 'unknown_unit' };
  }

  if (isMassUnit(unit)) {
    return { ok: true, grams: quantity * MASS_TO_GRAMS[unit], unit };
  }

  if (gramsPerUnit === undefined || gramsPerUnit === null) {
    return { ok: false, reason: 'missing_portion_grams' };
  }
  if (!Number.isFinite(gramsPerUnit) || gramsPerUnit <= 0) {
    return { ok: false, reason: 'invalid_quantity' };
  }

  return { ok: true, grams: quantity * gramsPerUnit, unit };
}
