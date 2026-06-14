'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { regenerateActivePlan } from '@/features/meal-plan/generate';
import { requireUser } from '@/lib/auth/get-user';
import { type BodyInput, computeBodyPlan } from '@/lib/nutrition/body';
import { generateMealPlan } from '@/lib/nutrition/meal-plan';
import { onboardingSchema } from '@/lib/validation/onboarding';
import { saveActivePlan } from '@/repositories/meal-plans.repo';
import {
  getSelectedPlanFoods,
  listSelectableFoods,
  setSelectedFoodIds,
} from '@/repositories/user-food-selections.repo';
import { setGoal } from '@/repositories/user-goals.repo';
import { getProfile, saveOnboarding } from '@/repositories/user-profile.repo';

import { selectionMeetsMinimums } from './food-selection';

export type CompleteOnboardingResult = { ok: true } | { ok: false; error: string };

const foodSelectionsSchema = z.array(z.string().uuid()).max(300);

/**
 * Persist the wizard answers and the deterministic plan they produce.
 *
 * The plan is computed server-side (authoritative) even though the client
 * previews it live, so the stored snapshot can never be tampered with from the
 * browser. The active macro goal is set from the same numbers so the dashboard
 * immediately reflects the new plan.
 */
export async function completeOnboardingAction(input: unknown): Promise<CompleteOnboardingResult> {
  const user = await requireUser();

  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Faltan datos o hay valores fuera de rango. Revisa el formulario.' };
  }

  const data = parsed.data;
  const bodyInput: BodyInput = {
    sex: data.sex,
    age: data.age,
    heightCm: data.heightCm,
    weightKg: data.weightKg,
    targetWeightKg: data.targetWeightKg,
    goal: data.goal,
    pace: data.pace,
    activityLevel: data.activityLevel,
    trainingDays: data.trainingDays,
    strengthTraining: data.strengthTraining,
    diet: data.diet,
  };

  try {
    const plan = computeBodyPlan(bodyInput);

    // Validate the food selection against the authoritative catalog: drop any
    // id that isn't a real selectable food, then re-check category minimums so
    // the browser can't submit an under-filled set.
    const catalog = await listSelectableFoods();
    const valid = new Set(catalog.map((f) => f.id));
    const selectedIds = data.foodSelections.filter((id) => valid.has(id));
    if (!selectionMeetsMinimums(new Set(selectedIds), catalog)) {
      return {
        ok: false,
        error: 'Elige los mínimos de alimentos por categoría para continuar.',
      };
    }

    await saveOnboarding(user, data, plan);
    await setGoal(user, {
      calorieTarget: plan.calorieTarget,
      proteinTarget: plan.macros.protein,
      carbsTarget: plan.macros.carbs,
      fatTarget: plan.macros.fat,
    });
    await setSelectedFoodIds(user, selectedIds);

    // Phase 3: generate and persist the meal plan from the selection. A
    // generation failure must not block onboarding (the user can regenerate
    // from the dashboard), so we log it with context and continue.
    try {
      const planFoods = await getSelectedPlanFoods(user);
      const mealPlan = generateMealPlan({
        calorieTarget: plan.calorieTarget,
        macros: plan.macros,
        mealsPerDay: data.mealsPerDay,
        mainMeals: data.mainMeals,
        foods: planFoods,
      });
      await saveActivePlan(user, {
        calorieTarget: plan.calorieTarget,
        proteinTarget: plan.macros.protein,
        carbsTarget: plan.macros.carbs,
        fatTarget: plan.macros.fat,
        mealsPerDay: data.mealsPerDay,
        mainMeals: data.mainMeals,
        suggestionStyle: data.suggestionStyle,
        plan: mealPlan,
      });
    } catch (genErr: unknown) {
      console.error('completeOnboardingAction: meal plan generation', genErr);
    }

    revalidatePath('/');
    return { ok: true };
  } catch (err: unknown) {
    console.error('completeOnboardingAction', err);
    return { ok: false, error: 'No pudimos guardar tu plan. Intenta de nuevo.' };
  }
}

export type UpdateFoodSelectionsResult = { ok: true } | { ok: false; error: string };

/**
 * Update the user's available-food set from the profile editor and regenerate
 * the active plan so it reflects the new foods. Mirrors the onboarding step:
 * ids are validated against the catalog and category minimums re-checked
 * server-side.
 */
export async function updateFoodSelectionsAction(input: unknown): Promise<UpdateFoodSelectionsResult> {
  const user = await requireUser();

  const parsed = foodSelectionsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Selección inválida.' };
  }

  const profile = await getProfile(user.id);
  if (!profile || profile.calorieTarget === null) {
    return { ok: false, error: 'Completa tu onboarding antes de editar tus alimentos.' };
  }

  try {
    const catalog = await listSelectableFoods();
    const valid = new Set(catalog.map((f) => f.id));
    const selectedIds = parsed.data.filter((id) => valid.has(id));
    if (!selectionMeetsMinimums(new Set(selectedIds), catalog)) {
      return { ok: false, error: 'Elige los mínimos de alimentos por categoría para continuar.' };
    }

    await setSelectedFoodIds(user, selectedIds);
    await regenerateActivePlan(user, profile);
    revalidatePath('/plan');
    revalidatePath('/record');
    revalidatePath('/foods');
    return { ok: true };
  } catch (err: unknown) {
    console.error('updateFoodSelectionsAction', err);
    return { ok: false, error: 'No pudimos guardar tus alimentos. Intenta de nuevo.' };
  }
}
