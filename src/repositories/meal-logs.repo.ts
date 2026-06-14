import 'server-only';

import { and, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm';

import { type AppDb, withUserContext } from '@/db/client';
import { foods, mealItems, mealLogs } from '@/db/schema';
import { newId } from '@/lib/crypto/uuid';
import type { Macros } from '@/lib/nutrition/macros';
import type { MealItemSource, MealType } from '@/lib/validation/meal';

/**
 * Meal logging persistence. Every method runs inside `withUserContext` so RLS
 * is active under the `authenticated` role - defense in depth even though each
 * query is also explicitly user-scoped.
 *
 * Macro snapshots are written at log time (CLAUDE.md §7): later edits to the
 * `foods` catalog must never rewrite a user's history.
 */

export interface PreparedMealItem {
  foodId: string;
  quantity: number;
  unit: string;
  quantityGrams: number;
  source: MealItemSource;
  macros: Pick<Macros, 'calories' | 'protein' | 'carbs' | 'fat'>;
}

export interface CreateMealLogParams {
  mealType: MealType;
  loggedAt: Date;
  notes?: string | null;
  items: PreparedMealItem[];
}

/**
 * The current user, carrying both ids: `clerkId` opens the RLS context,
 * `id` (internal UUID) is what gets written to user_id columns.
 */
export interface AppUserRef {
  id: string;
  clerkId: string;
}

export async function createMealLog(
  user: AppUserRef,
  params: CreateMealLogParams,
): Promise<{ mealLogId: string }> {
  if (params.items.length === 0) {
    throw new Error('createMealLog: at least one item is required');
  }

  return withUserContext(user.clerkId, async (tx: AppDb) => {
    const mealLogId = newId();

    await tx.insert(mealLogs).values({
      id: mealLogId,
      userId: user.id,
      loggedAt: params.loggedAt,
      mealType: params.mealType,
      notes: params.notes ?? null,
    });

    await tx.insert(mealItems).values(
      params.items.map((item) => ({
        id: newId(),
        mealLogId,
        foodId: item.foodId,
        quantity: item.quantity.toFixed(2),
        unit: item.unit,
        quantityGrams: item.quantityGrams.toFixed(2),
        source: item.source,
        caloriesSnapshot: item.macros.calories.toFixed(2),
        proteinSnapshot: item.macros.protein.toFixed(2),
        carbsSnapshot: item.macros.carbs.toFixed(2),
        fatSnapshot: item.macros.fat.toFixed(2),
      })),
    );

    return { mealLogId };
  });
}

export interface DayMacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Sum macro snapshots for one calendar day [dayStart, dayStart+24h). Aggregation
 * uses the denormalized snapshot columns - no join to `foods` - so it stays
 * fast and historically accurate.
 */
export async function getDayMacroTotals(
  user: AppUserRef,
  dayStart: Date,
  dayEnd: Date,
): Promise<DayMacroTotals> {
  return withUserContext(user.clerkId, async (tx: AppDb) => {
    const rows = await tx
      .select({
        calories: sql<string>`coalesce(sum(${mealItems.caloriesSnapshot}), 0)`,
        protein: sql<string>`coalesce(sum(${mealItems.proteinSnapshot}), 0)`,
        carbs: sql<string>`coalesce(sum(${mealItems.carbsSnapshot}), 0)`,
        fat: sql<string>`coalesce(sum(${mealItems.fatSnapshot}), 0)`,
      })
      .from(mealItems)
      .innerJoin(mealLogs, eq(mealItems.mealLogId, mealLogs.id))
      .where(
        and(
          eq(mealLogs.userId, user.id),
          isNull(mealLogs.deletedAt),
          isNull(mealItems.deletedAt),
          gte(mealLogs.loggedAt, dayStart),
          lt(mealLogs.loggedAt, dayEnd),
        ),
      );

    const r = rows[0];
    return {
      calories: Number(r?.calories ?? 0),
      protein: Number(r?.protein ?? 0),
      carbs: Number(r?.carbs ?? 0),
      fat: Number(r?.fat ?? 0),
    };
  });
}

/**
 * Soft-delete or restore a single logged item. RLS (meal_items policy cascades
 * to the parent meal_log owner) guarantees the user can only touch their own
 * rows, so id alone is a safe target. Used for delete + undo on the dashboard.
 */
export async function setMealItemDeleted(
  user: AppUserRef,
  mealItemId: string,
  deleted: boolean,
): Promise<void> {
  await withUserContext(user.clerkId, async (tx: AppDb) => {
    await tx
      .update(mealItems)
      .set({ deletedAt: deleted ? new Date() : null })
      .where(eq(mealItems.id, mealItemId));
  });
}

export interface DayEntry {
  mealItemId: string;
  mealLogId: string;
  foodName: string;
  mealType: MealType;
  quantityGrams: number;
  calories: number;
  loggedAt: Date;
}

/**
 * Today's logged items with their food name, newest first, for the dashboard
 * list. Joins through to `foods` only for the display name; macro figures come
 * from the frozen snapshot columns.
 */
export async function getDayEntries(
  user: AppUserRef,
  dayStart: Date,
  dayEnd: Date,
): Promise<DayEntry[]> {
  return withUserContext(user.clerkId, async (tx: AppDb) => {
    const rows = await tx
      .select({
        mealItemId: mealItems.id,
        mealLogId: mealLogs.id,
        foodName: foods.nameEs,
        mealType: mealLogs.mealType,
        quantityGrams: mealItems.quantityGrams,
        calories: mealItems.caloriesSnapshot,
        loggedAt: mealLogs.loggedAt,
      })
      .from(mealItems)
      .innerJoin(mealLogs, eq(mealItems.mealLogId, mealLogs.id))
      .innerJoin(foods, eq(mealItems.foodId, foods.id))
      .where(
        and(
          eq(mealLogs.userId, user.id),
          isNull(mealLogs.deletedAt),
          isNull(mealItems.deletedAt),
          gte(mealLogs.loggedAt, dayStart),
          lt(mealLogs.loggedAt, dayEnd),
        ),
      )
      .orderBy(desc(mealLogs.loggedAt));

    return rows.map((r) => ({
      mealItemId: r.mealItemId,
      mealLogId: r.mealLogId,
      foodName: r.foodName,
      mealType: r.mealType,
      quantityGrams: Number(r.quantityGrams),
      calories: Number(r.calories),
      loggedAt: r.loggedAt,
    }));
  });
}
