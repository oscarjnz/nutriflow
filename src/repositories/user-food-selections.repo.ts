import 'server-only';

import { asc, eq, ne } from 'drizzle-orm';

import { adminDb, type AppDb, withUserContext } from '@/db/client';
import { foods, userFoodSelections } from '@/db/schema';
import type { SelectableCategory, SelectableFood } from '@/features/onboarding/food-selection';
import type { PlanCategory, PlanFoodInput } from '@/lib/nutrition/meal-plan';

import type { AppUserRef } from './meal-logs.repo';

/**
 * Catalog of foods the onboarding picker offers, grouped-ready (ordered by
 * category then Spanish name). Public catalog read, so it goes through adminDb
 * like the rest of the catalog access. Excludes 'other' (branded/packaged).
 */
export async function listSelectableFoods(): Promise<SelectableFood[]> {
  const rows = await adminDb
    .select({ id: foods.id, nameEs: foods.nameEs, category: foods.category })
    .from(foods)
    .where(ne(foods.category, 'other'))
    .orderBy(asc(foods.category), asc(foods.nameEs));

  return rows.map((r) => ({
    id: r.id,
    nameEs: r.nameEs,
    category: r.category as SelectableCategory,
  }));
}

/**
 * The user's selected foods with the nutrition the meal generator needs.
 * Excludes 'other' so a stray branded product can't enter plan generation.
 */
export async function getSelectedPlanFoods(user: AppUserRef): Promise<PlanFoodInput[]> {
  const rows = await withUserContext(user.clerkId, (tx: AppDb) =>
    tx
      .select({
        id: foods.id,
        nameEs: foods.nameEs,
        category: foods.category,
        calories: foods.calories,
        protein: foods.protein,
        carbs: foods.carbs,
        fat: foods.fat,
      })
      .from(userFoodSelections)
      .innerJoin(foods, eq(userFoodSelections.foodId, foods.id))
      .where(eq(userFoodSelections.userId, user.id)),
  );

  return rows
    .filter((r) => r.category !== 'other')
    .map((r) => ({
      id: r.id,
      nameEs: r.nameEs,
      category: r.category as PlanCategory,
      per100g: {
        calories: Number(r.calories),
        protein: Number(r.protein),
        carbs: Number(r.carbs),
        fat: Number(r.fat),
      },
    }));
}

/** Food ids the user currently has marked as available. */
export async function getSelectedFoodIds(user: AppUserRef): Promise<string[]> {
  const rows = await withUserContext(user.clerkId, (tx) =>
    tx
      .select({ foodId: userFoodSelections.foodId })
      .from(userFoodSelections)
      .where(eq(userFoodSelections.userId, user.id)),
  );
  return rows.map((r) => r.foodId);
}

/**
 * Replace the user's available-food set with exactly `foodIds`. Done as
 * delete-all + insert inside one transaction so the set is always consistent;
 * the FK to foods rejects any id that isn't a real food.
 */
export async function setSelectedFoodIds(user: AppUserRef, foodIds: string[]): Promise<void> {
  const unique = [...new Set(foodIds)];

  await withUserContext(user.clerkId, async (tx) => {
    await tx.delete(userFoodSelections).where(eq(userFoodSelections.userId, user.id));
    if (unique.length > 0) {
      await tx
        .insert(userFoodSelections)
        .values(unique.map((foodId) => ({ userId: user.id, foodId })))
        .onConflictDoNothing();
    }
  });
}
