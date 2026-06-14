'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/lib/auth/get-user';
import { type BodyInput, computeBodyPlan } from '@/lib/nutrition/body';
import { onboardingSchema } from '@/lib/validation/onboarding';
import { setGoal } from '@/repositories/user-goals.repo';
import { saveOnboarding } from '@/repositories/user-profile.repo';

export type CompleteOnboardingResult = { ok: true } | { ok: false; error: string };

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
    await saveOnboarding(user, data, plan);
    await setGoal(user, {
      calorieTarget: plan.calorieTarget,
      proteinTarget: plan.macros.protein,
      carbsTarget: plan.macros.carbs,
      fatTarget: plan.macros.fat,
    });
    revalidatePath('/');
    return { ok: true };
  } catch (err: unknown) {
    console.error('completeOnboardingAction', err);
    return { ok: false, error: 'No pudimos guardar tu plan. Intenta de nuevo.' };
  }
}
