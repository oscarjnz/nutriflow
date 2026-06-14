'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/lib/auth/get-user';
import { generateMealPlan } from '@/lib/nutrition/meal-plan';
import { createMealLog } from '@/repositories/meal-logs.repo';
import { getActivePlan, saveActivePlan } from '@/repositories/meal-plans.repo';
import { getSelectedPlanFoods } from '@/repositories/user-food-selections.repo';
import { getProfile } from '@/repositories/user-profile.repo';

export type MealPlanActionResult = { ok: true } | { ok: false; error: string };

/**
 * Regenerate the active plan from the user's current profile targets + food
 * selection. Deterministic given the same inputs; the previous plan is
 * soft-deleted by saveActivePlan.
 */
export async function regeneratePlanAction(): Promise<MealPlanActionResult> {
  const user = await requireUser();
  const profile = await getProfile(user.id);

  if (!profile || profile.calorieTarget === null) {
    return { ok: false, error: 'Completa tu onboarding antes de generar un plan.' };
  }

  try {
    const foods = await getSelectedPlanFoods(user);
    const plan = generateMealPlan({
      calorieTarget: profile.calorieTarget,
      macros: {
        protein: profile.proteinTarget ?? 0,
        carbs: profile.carbsTarget ?? 0,
        fat: profile.fatTarget ?? 0,
      },
      mealsPerDay: profile.mealsPerDay,
      mainMeals: profile.mainMeals,
      foods,
    });
    await saveActivePlan(user, {
      calorieTarget: profile.calorieTarget,
      proteinTarget: profile.proteinTarget ?? 0,
      carbsTarget: profile.carbsTarget ?? 0,
      fatTarget: profile.fatTarget ?? 0,
      mealsPerDay: profile.mealsPerDay,
      mainMeals: profile.mainMeals,
      suggestionStyle: profile.suggestionStyle,
      plan,
    });
    revalidatePath('/plan');
    revalidatePath('/record');
    return { ok: true };
  } catch (err: unknown) {
    console.error('regeneratePlanAction', err);
    return {
      ok: false,
      error: 'No pudimos generar el plan. Revisa que tengas alimentos seleccionados.',
    };
  }
}

/**
 * Log a whole planned meal (by slot) into today's diary in one tap. Copies the
 * plan items' frozen macro snapshots into the meal log so history is stable.
 */
export async function logPlannedMealAction(slot: number): Promise<MealPlanActionResult> {
  const user = await requireUser();

  if (!Number.isInteger(slot) || slot < 0) {
    return { ok: false, error: 'Comida inválida.' };
  }

  try {
    const plan = await getActivePlan(user);
    const meal = plan?.meals.find((m) => m.slot === slot);
    if (!meal || meal.items.length === 0) {
      return { ok: false, error: 'Esa comida ya no está en tu plan.' };
    }

    await createMealLog(user, {
      mealType: meal.mealType,
      loggedAt: new Date(),
      items: meal.items.map((item) => ({
        foodId: item.foodId,
        quantity: item.grams,
        unit: 'g',
        quantityGrams: item.grams,
        source: 'recipe',
        macros: {
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
        },
      })),
    });

    revalidatePath('/');
    return { ok: true };
  } catch (err: unknown) {
    console.error('logPlannedMealAction', err);
    return { ok: false, error: 'No pudimos registrar la comida. Intenta de nuevo.' };
  }
}
