import 'server-only';

import { generateMealPlan } from '@/lib/nutrition/meal-plan';
import type { AppUserRef } from '@/repositories/meal-logs.repo';
import { saveActivePlan } from '@/repositories/meal-plans.repo';
import { getSelectedPlanFoods } from '@/repositories/user-food-selections.repo';
import type { UserProfile } from '@/repositories/user-profile.repo';

/**
 * Generate the deterministic meal plan from a user's stored targets + current
 * food selection and persist it as the active plan. Shared by the regenerate
 * action and the food-selection editor so both stay in sync. Throws if there is
 * nothing to build from (caller decides how to surface that).
 */
export async function regenerateActivePlan(user: AppUserRef, profile: UserProfile): Promise<void> {
  const targets = {
    calorieTarget: profile.calorieTarget ?? 0,
    proteinTarget: profile.proteinTarget ?? 0,
    carbsTarget: profile.carbsTarget ?? 0,
    fatTarget: profile.fatTarget ?? 0,
  };

  const foods = await getSelectedPlanFoods(user);
  const plan = generateMealPlan({
    calorieTarget: targets.calorieTarget,
    macros: { protein: targets.proteinTarget, carbs: targets.carbsTarget, fat: targets.fatTarget },
    mealsPerDay: profile.mealsPerDay,
    mainMeals: profile.mainMeals,
    foods,
  });

  await saveActivePlan(user, {
    ...targets,
    mealsPerDay: profile.mealsPerDay,
    mainMeals: profile.mainMeals,
    suggestionStyle: profile.suggestionStyle,
    plan,
  });
}
