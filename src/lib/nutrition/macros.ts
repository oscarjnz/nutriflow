/**
 * Deterministic macro arithmetic.
 *
 * Per CLAUDE.md §5, no calorie/macro figure may originate from an LLM. All
 * scaling and aggregation lives here as pure functions over plain numbers,
 * decoupled from the DB row shape (which stores numeric columns as strings).
 *
 * Catalog convention: every macro column on `foods` is expressed **per 100 g**
 * of edible portion, matching USDA FoodData Central's reporting basis. To get
 * the macros for an arbitrary amount, scale by `grams / 100`.
 */

export interface MacrosPer100g {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number | null;
  sugar?: number | null;
  sodium?: number | null;
}

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
}

/** Round to 2 decimals (matches numeric(8,2)) without float drift artifacts. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function scaleOptional(value: number | null | undefined, factor: number): number | null {
  if (value === null || value === undefined) return null;
  return round2(value * factor);
}

/**
 * Scale per-100g macros to `grams`. Throws on non-finite/negative grams so a
 * bad call surfaces immediately rather than silently producing NaN rows.
 */
export function computeMacros(per100g: MacrosPer100g, grams: number): Macros {
  if (!Number.isFinite(grams) || grams < 0) {
    throw new RangeError(`computeMacros: grams must be a non-negative finite number, got ${grams}`);
  }
  const factor = grams / 100;
  return {
    calories: round2(per100g.calories * factor),
    protein: round2(per100g.protein * factor),
    carbs: round2(per100g.carbs * factor),
    fat: round2(per100g.fat * factor),
    fiber: scaleOptional(per100g.fiber, factor),
    sugar: scaleOptional(per100g.sugar, factor),
    sodium: scaleOptional(per100g.sodium, factor),
  };
}

/** Element-wise sum of macro entries. Optional fields sum only present values. */
export function sumMacros(entries: readonly Macros[]): Macros {
  const total: Macros = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: null,
    sugar: null,
    sodium: null,
  };

  for (const e of entries) {
    total.calories += e.calories;
    total.protein += e.protein;
    total.carbs += e.carbs;
    total.fat += e.fat;
    total.fiber = addOptional(total.fiber, e.fiber);
    total.sugar = addOptional(total.sugar, e.sugar);
    total.sodium = addOptional(total.sodium, e.sodium);
  }

  return {
    calories: round2(total.calories),
    protein: round2(total.protein),
    carbs: round2(total.carbs),
    fat: round2(total.fat),
    fiber: total.fiber === null ? null : round2(total.fiber),
    sugar: total.sugar === null ? null : round2(total.sugar),
    sodium: total.sodium === null ? null : round2(total.sodium),
  };
}

function addOptional(acc: number | null, value: number | null): number | null {
  if (value === null) return acc;
  return (acc ?? 0) + value;
}

/**
 * Atwater energy estimate (4/4/9 kcal per g). Used only to sanity-check
 * catalog rows and surface obviously corrupt USDA/OFF entries during seeding -
 * never to overwrite the source calorie value.
 */
export function atwaterCalories(protein: number, carbs: number, fat: number): number {
  return round2(protein * 4 + carbs * 4 + fat * 9);
}

/** Macros target remaining against a goal; negatives mean the goal is exceeded. */
export function remainingAgainstTarget(
  consumed: Pick<Macros, 'calories' | 'protein' | 'carbs' | 'fat'>,
  target: { calories: number; protein: number; carbs: number; fat: number },
): { calories: number; protein: number; carbs: number; fat: number } {
  return {
    calories: round2(target.calories - consumed.calories),
    protein: round2(target.protein - consumed.protein),
    carbs: round2(target.carbs - consumed.carbs),
    fat: round2(target.fat - consumed.fat),
  };
}
