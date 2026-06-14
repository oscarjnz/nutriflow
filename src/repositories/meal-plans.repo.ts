import 'server-only';

import { and, asc, eq, isNull } from 'drizzle-orm';

import { type AppDb, withUserContext } from '@/db/client';
import { foods, mealPlanItems, mealPlans } from '@/db/schema';
import { newId } from '@/lib/crypto/uuid';
import { round2 } from '@/lib/nutrition/macros';
import type { GeneratedPlan, PlanMealType } from '@/lib/nutrition/meal-plan';

import type { AppUserRef } from './meal-logs.repo';

export interface SavePlanParams {
  calorieTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  mealsPerDay: number;
  mainMeals: number;
  suggestionStyle: 'recipes' | 'ingredients' | 'mixed' | null;
  plan: GeneratedPlan;
}

/**
 * Replace the user's active plan with a freshly generated one. The previous
 * active plan is soft-deleted (kept for history) and the new rows are written
 * inside a single transaction under the user's RLS context. Macro figures are
 * snapshotted from the generator output.
 */
export async function saveActivePlan(
  user: AppUserRef,
  params: SavePlanParams,
): Promise<{ planId: string }> {
  return withUserContext(user.clerkId, async (tx: AppDb) => {
    await tx
      .update(mealPlans)
      .set({ active: false, deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(mealPlans.userId, user.id), eq(mealPlans.active, true), isNull(mealPlans.deletedAt)));

    const planId = newId();
    await tx.insert(mealPlans).values({
      id: planId,
      userId: user.id,
      calorieTarget: params.calorieTarget,
      proteinTarget: params.proteinTarget,
      carbsTarget: params.carbsTarget,
      fatTarget: params.fatTarget,
      mealsPerDay: params.mealsPerDay,
      mainMeals: params.mainMeals,
      suggestionStyle: params.suggestionStyle,
    });

    const rows = params.plan.meals.flatMap((meal) =>
      meal.items.map((item, position) => ({
        id: newId(),
        mealPlanId: planId,
        slot: meal.slot,
        mealType: meal.mealType,
        position,
        foodId: item.foodId,
        grams: item.grams.toFixed(2),
        caloriesSnapshot: item.calories.toFixed(2),
        proteinSnapshot: item.protein.toFixed(2),
        carbsSnapshot: item.carbs.toFixed(2),
        fatSnapshot: item.fat.toFixed(2),
      })),
    );
    if (rows.length > 0) await tx.insert(mealPlanItems).values(rows);

    return { planId };
  });
}

export interface ActivePlanItem {
  id: string;
  foodId: string;
  foodName: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface ActivePlanMeal {
  slot: number;
  mealType: PlanMealType;
  items: ActivePlanItem[];
  totals: { calories: number; protein: number; carbs: number; fat: number };
}

export interface ActivePlan {
  id: string;
  calorieTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  mealsPerDay: number;
  mainMeals: number;
  suggestionStyle: 'recipes' | 'ingredients' | 'mixed' | null;
  createdAt: Date;
  meals: ActivePlanMeal[];
  totals: { calories: number; protein: number; carbs: number; fat: number };
}

/** The user's current active plan with its meals + items, or null if none. */
export async function getActivePlan(user: AppUserRef): Promise<ActivePlan | null> {
  return withUserContext(user.clerkId, async (tx: AppDb) => {
    const plans = await tx
      .select()
      .from(mealPlans)
      .where(and(eq(mealPlans.userId, user.id), eq(mealPlans.active, true), isNull(mealPlans.deletedAt)))
      .limit(1);

    const plan = plans[0];
    if (!plan) return null;

    const itemRows = await tx
      .select({
        id: mealPlanItems.id,
        slot: mealPlanItems.slot,
        mealType: mealPlanItems.mealType,
        foodId: mealPlanItems.foodId,
        foodName: foods.nameEs,
        grams: mealPlanItems.grams,
        calories: mealPlanItems.caloriesSnapshot,
        protein: mealPlanItems.proteinSnapshot,
        carbs: mealPlanItems.carbsSnapshot,
        fat: mealPlanItems.fatSnapshot,
      })
      .from(mealPlanItems)
      .innerJoin(foods, eq(mealPlanItems.foodId, foods.id))
      .where(eq(mealPlanItems.mealPlanId, plan.id))
      .orderBy(asc(mealPlanItems.slot), asc(mealPlanItems.position));

    const mealsBySlot = new Map<number, ActivePlanMeal>();
    for (const r of itemRows) {
      const item: ActivePlanItem = {
        id: r.id,
        foodId: r.foodId,
        foodName: r.foodName,
        grams: Number(r.grams),
        calories: Number(r.calories),
        protein: Number(r.protein),
        carbs: Number(r.carbs),
        fat: Number(r.fat),
      };
      let meal = mealsBySlot.get(r.slot);
      if (!meal) {
        meal = {
          slot: r.slot,
          mealType: r.mealType,
          items: [],
          totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
        };
        mealsBySlot.set(r.slot, meal);
      }
      meal.items.push(item);
      meal.totals.calories += item.calories;
      meal.totals.protein += item.protein;
      meal.totals.carbs += item.carbs;
      meal.totals.fat += item.fat;
    }

    const meals = [...mealsBySlot.values()]
      .sort((a, b) => a.slot - b.slot)
      .map((m) => ({
        ...m,
        totals: {
          calories: round2(m.totals.calories),
          protein: round2(m.totals.protein),
          carbs: round2(m.totals.carbs),
          fat: round2(m.totals.fat),
        },
      }));

    const totals = meals.reduce(
      (acc, m) => ({
        calories: round2(acc.calories + m.totals.calories),
        protein: round2(acc.protein + m.totals.protein),
        carbs: round2(acc.carbs + m.totals.carbs),
        fat: round2(acc.fat + m.totals.fat),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );

    return {
      id: plan.id,
      calorieTarget: plan.calorieTarget,
      proteinTarget: plan.proteinTarget,
      carbsTarget: plan.carbsTarget,
      fatTarget: plan.fatTarget,
      mealsPerDay: plan.mealsPerDay,
      mainMeals: plan.mainMeals,
      suggestionStyle: plan.suggestionStyle,
      createdAt: plan.createdAt,
      meals,
      totals,
    };
  });
}
