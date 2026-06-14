import 'server-only';

import { computeMacros } from '@/lib/nutrition/macros';
import type { MealItemSource } from '@/lib/validation/meal';
import { getFoodForSnapshot } from '@/repositories/foods.repo';
import type { PreparedMealItem } from '@/repositories/meal-logs.repo';

/**
 * Turn a (foodId, grams) selection into a fully-snapshotted meal item.
 *
 * Macros are computed deterministically from the catalog's per-100g values
 * (CLAUDE.md §5 - never the LLM) and frozen into the item, so later catalog
 * edits never rewrite history. Sprint 1 logs in grams; named portions (taza,
 * cucharada) layer on later via food_servings + lib/nutrition/units.
 */
export async function prepareMealItem(
  foodId: string,
  grams: number,
  source: MealItemSource = 'manual',
): Promise<PreparedMealItem> {
  const food = await getFoodForSnapshot(foodId);
  if (!food) {
    throw new Error(`prepareMealItem: food ${foodId} not found`);
  }

  const macros = computeMacros(
    {
      calories: food.caloriesPer100g,
      protein: food.proteinPer100g,
      carbs: food.carbsPer100g,
      fat: food.fatPer100g,
    },
    grams,
  );

  return {
    foodId,
    quantity: grams,
    unit: 'g',
    quantityGrams: grams,
    source,
    macros,
  };
}
