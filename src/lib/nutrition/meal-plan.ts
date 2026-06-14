/**
 * Deterministic meal-plan generator.
 *
 * Per CLAUDE.md §1/§5, every gram and calorie here is computed in pure
 * TypeScript - no LLM. Given the day's calorie + macro targets, the meal
 * structure (how many meals, how many of them are "main"), and the foods the
 * user marked as available (grouped by category), this assembles a concrete
 * day of meals whose portions aim at the macro targets. Same input always
 * yields the same plan, so regenerating is reproducible and testable.
 *
 * Strategy (greedy, macro-driven): the day's protein/carb/fat grams are split
 * across meals by weight (main meals carry more than snacks). Within a meal,
 * each macro is delivered by a food playing a role - a protein source sized to
 * the meal's protein budget, a grain sized to its carb budget, a fat source for
 * the remaining fat, plus a fixed vegetable portion. Because macros define
 * calories (4/4/9), hitting the macro grams keeps calories on target.
 */

import { computeMacros, round2 } from './macros';

export type PlanMealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** Categories the generator reasons about (mirrors foods.category, sans 'other'). */
export type PlanCategory =
  | 'protein'
  | 'grain'
  | 'vegetable'
  | 'fruit'
  | 'legume'
  | 'dairy'
  | 'fat';

export interface PlanFoodInput {
  id: string;
  nameEs: string;
  category: PlanCategory;
  per100g: { calories: number; protein: number; carbs: number; fat: number };
}

export interface PlanItem {
  foodId: string;
  nameEs: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface PlanMealTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface PlanMeal {
  slot: number;
  mealType: PlanMealType;
  items: PlanItem[];
  totals: PlanMealTotals;
}

export interface GeneratedPlan {
  meals: PlanMeal[];
  totals: PlanMealTotals;
}

export interface MealPlanInput {
  calorieTarget: number;
  macros: { protein: number; carbs: number; fat: number };
  mealsPerDay: number;
  mainMeals: number;
  foods: readonly PlanFoodInput[];
}

// ── Tunable portion bounds (grams) ───────────────────────────────────────────

const PROTEIN_BOUNDS = { min: 40, max: 320 } as const;
const GRAIN_BOUNDS = { min: 25, max: 320 } as const;
const FAT_BOUNDS = { min: 0, max: 60 } as const;
const FRUIT_BOUNDS = { min: 80, max: 280 } as const;
const DAIRY_BOUNDS = { min: 50, max: 300 } as const;
const VEGETABLE_GRAMS = 100;

/** Below this per-100g value a food can't sensibly deliver that macro by mass. */
const MIN_DENSITY = 0.5;
/** A snack carries this fraction of a main meal's macro budget. */
const SNACK_WEIGHT = 0.4;

const MAIN_TYPES: readonly PlanMealType[] = ['breakfast', 'lunch', 'dinner'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Grams of a food needed to deliver `targetGrams` of one macro, bounded. */
function gramsForMacro(
  targetGrams: number,
  per100: number,
  bounds: { min: number; max: number },
  fallback: number,
): number {
  if (per100 < MIN_DENSITY) return clamp(fallback, bounds.min, bounds.max);
  return clamp(Math.round((targetGrams * 100) / per100), bounds.min, bounds.max);
}

function itemFrom(food: PlanFoodInput, grams: number): PlanItem {
  const m = computeMacros(food.per100g, grams);
  return {
    foodId: food.id,
    nameEs: food.nameEs,
    grams,
    calories: m.calories,
    protein: m.protein,
    carbs: m.carbs,
    fat: m.fat,
  };
}

function totalsOf(items: readonly PlanItem[]): PlanMealTotals {
  const t = items.reduce(
    (acc, i) => ({
      calories: acc.calories + i.calories,
      protein: acc.protein + i.protein,
      carbs: acc.carbs + i.carbs,
      fat: acc.fat + i.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return {
    calories: round2(t.calories),
    protein: round2(t.protein),
    carbs: round2(t.carbs),
    fat: round2(t.fat),
  };
}

function byCategory(foods: readonly PlanFoodInput[], category: PlanCategory): PlanFoodInput[] {
  return foods.filter((f) => f.category === category);
}

/** Deterministic pick: rotate through a pool by meal index for variety. */
function pick(pool: readonly PlanFoodInput[], index: number): PlanFoodInput | null {
  if (pool.length === 0) return null;
  return pool[index % pool.length] ?? null;
}

// ── Meal builders ──────────────────────────────────────────────────────────--

interface Pools {
  protein: PlanFoodInput[];
  grain: PlanFoodInput[];
  vegetable: PlanFoodInput[];
  fruit: PlanFoodInput[];
  dairy: PlanFoodInput[];
  fat: PlanFoodInput[];
}

interface MacroBudget {
  protein: number;
  carbs: number;
  fat: number;
}

function buildMainMeal(pools: Pools, budget: MacroBudget, index: number): PlanItem[] {
  const items: PlanItem[] = [];

  // Protein source sized to the meal's protein budget. Legumes back up protein.
  const proteinPool = pools.protein.length > 0 ? pools.protein : pools.dairy;
  const proteinFood = pick(proteinPool, index);
  if (proteinFood) {
    items.push(
      itemFrom(proteinFood, gramsForMacro(budget.protein, proteinFood.per100g.protein, PROTEIN_BOUNDS, 120)),
    );
  }

  // Grain/starch sized to the carb budget.
  const grainFood = pick(pools.grain, index);
  if (grainFood) {
    items.push(itemFrom(grainFood, gramsForMacro(budget.carbs, grainFood.per100g.carbs, GRAIN_BOUNDS, 120)));
  }

  // A fixed vegetable portion for volume + micronutrients.
  const vegFood = pick(pools.vegetable, index);
  if (vegFood) items.push(itemFrom(vegFood, VEGETABLE_GRAMS));

  // Fat source fills the fat budget not already covered by the items above.
  const fatFood = pick(pools.fat, index);
  if (fatFood) {
    const fatSoFar = items.reduce((acc, i) => acc + i.fat, 0);
    const remaining = Math.max(0, budget.fat - fatSoFar);
    const grams = gramsForMacro(remaining, fatFood.per100g.fat, FAT_BOUNDS, 10);
    if (grams > 0) items.push(itemFrom(fatFood, grams));
  }

  return items;
}

function buildSnack(pools: Pools, budget: MacroBudget, index: number): PlanItem[] {
  const items: PlanItem[] = [];

  // Dairy (if available) covers snack protein; otherwise lean on fruit + nuts.
  const dairyFood = pick(pools.dairy, index);
  if (dairyFood) {
    items.push(itemFrom(dairyFood, gramsForMacro(budget.protein, dairyFood.per100g.protein, DAIRY_BOUNDS, 150)));
  }

  const fruitFood = pick(pools.fruit, index);
  if (fruitFood) {
    items.push(itemFrom(fruitFood, gramsForMacro(budget.carbs, fruitFood.per100g.carbs, FRUIT_BOUNDS, 120)));
  }

  // Top up fat with a fat source if the snack still lacks it.
  const fatFood = pick(pools.fat, index + 1);
  if (fatFood) {
    const fatSoFar = items.reduce((acc, i) => acc + i.fat, 0);
    const remaining = Math.max(0, budget.fat - fatSoFar);
    const grams = gramsForMacro(remaining, fatFood.per100g.fat, { min: 0, max: 30 }, 0);
    if (grams > 0) items.push(itemFrom(fatFood, grams));
  }

  return items;
}

// ── Public entry ───────────────────────────────────────────────────────────--

/**
 * Build a full day of meals from the targets and the available foods.
 * Throws if there are not enough foods to assemble even one meal.
 */
export function generateMealPlan(input: MealPlanInput): GeneratedPlan {
  const mealsPerDay = clamp(Math.round(input.mealsPerDay), 1, 8);
  const mains = clamp(Math.round(input.mainMeals), 1, mealsPerDay);
  const snacks = mealsPerDay - mains;

  const pools: Pools = {
    // Legumes double as a protein/carb hybrid; append them to the protein pool.
    protein: [...byCategory(input.foods, 'protein'), ...byCategory(input.foods, 'legume')],
    grain: byCategory(input.foods, 'grain'),
    vegetable: byCategory(input.foods, 'vegetable'),
    fruit: byCategory(input.foods, 'fruit'),
    dairy: byCategory(input.foods, 'dairy'),
    fat: byCategory(input.foods, 'fat'),
  };

  if (pools.protein.length === 0 && pools.grain.length === 0) {
    throw new Error('generateMealPlan: need at least one protein or grain food to build a plan');
  }

  const totalWeight = mains * 1 + snacks * SNACK_WEIGHT;
  const dayMacros: MacroBudget = {
    protein: input.macros.protein,
    carbs: input.macros.carbs,
    fat: input.macros.fat,
  };

  const meals: PlanMeal[] = [];

  for (let i = 0; i < mains; i += 1) {
    const w = 1 / totalWeight;
    const budget: MacroBudget = {
      protein: dayMacros.protein * w,
      carbs: dayMacros.carbs * w,
      fat: dayMacros.fat * w,
    };
    const items = buildMainMeal(pools, budget, i);
    meals.push({
      slot: meals.length,
      mealType: MAIN_TYPES[i] ?? 'snack',
      items,
      totals: totalsOf(items),
    });
  }

  for (let i = 0; i < snacks; i += 1) {
    const w = SNACK_WEIGHT / totalWeight;
    const budget: MacroBudget = {
      protein: dayMacros.protein * w,
      carbs: dayMacros.carbs * w,
      fat: dayMacros.fat * w,
    };
    const items = buildSnack(pools, budget, i);
    meals.push({ slot: meals.length, mealType: 'snack', items, totals: totalsOf(items) });
  }

  return { meals, totals: totalsOf(meals.flatMap((m) => m.items)) };
}
