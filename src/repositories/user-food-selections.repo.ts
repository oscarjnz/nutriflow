import 'server-only';

import { asc, eq, ne } from 'drizzle-orm';

import { adminDb, withUserContext } from '@/db/client';
import { foods, userFoodSelections } from '@/db/schema';
import type { SelectableCategory, SelectableFood } from '@/features/onboarding/food-selection';

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
