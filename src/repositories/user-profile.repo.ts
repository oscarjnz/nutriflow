import 'server-only';

import { eq } from 'drizzle-orm';

import { adminDb, withUserContext } from '@/db/client';
import { userProfiles } from '@/db/schema';
import type { BodyPlan } from '@/lib/nutrition/body';
import type { OnboardingInput } from '@/lib/validation/onboarding';

import type { AppUserRef } from './meal-logs.repo';

/** Profile as the app consumes it: numerics narrowed back to numbers. */
export interface UserProfile {
  recordName: string | null;
  goal: 'lose_fat' | 'gain_muscle' | 'maintain';
  method: 'meal_plan' | 'count_calories';
  sex: 'male' | 'female';
  age: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  pace: 'slow' | 'recommended' | 'fast';
  activityLevel: 'sedentary' | 'light' | 'active' | 'very_active';
  trainingDays: number;
  strengthTraining: boolean;
  diet: 'recommended' | 'high_protein' | 'low_carb' | 'keto' | 'low_fat';
  measurementUnits: 'metric' | 'imperial';
  mealsPerDay: number;
  mainMeals: number;
  suggestionStyle: 'recipes' | 'ingredients' | 'mixed' | null;
  intermittentFasting: 'never' | 'tried' | 'current' | 'want' | null;
  hardest: string | null;
  extraGoal: string | null;
  bmr: number | null;
  tdee: number | null;
  bmi: number | null;
  calorieTarget: number | null;
  proteinTarget: number | null;
  carbsTarget: number | null;
  fatTarget: number | null;
  weeklyRateKg: number | null;
  estimatedWeeks: number | null;
  onboardingCompleted: boolean;
}

function n(value: string | null): number | null {
  return value === null ? null : Number(value);
}

/**
 * Read the profile for the gate / dashboard. Keyed by internal id via adminDb
 * (same hot-path pattern as get-user) so the redirect check is one fast query.
 */
export async function getProfile(userId: string): Promise<UserProfile | null> {
  const rows = await adminDb
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  const r = rows[0];
  if (!r) return null;

  return {
    recordName: r.recordName,
    goal: r.goal,
    method: r.method,
    sex: r.sex,
    age: r.age,
    heightCm: Number(r.heightCm),
    weightKg: Number(r.weightKg),
    targetWeightKg: Number(r.targetWeightKg),
    pace: r.pace,
    activityLevel: r.activityLevel,
    trainingDays: r.trainingDays,
    strengthTraining: r.strengthTraining,
    diet: r.diet,
    measurementUnits: r.measurementUnits,
    mealsPerDay: r.mealsPerDay,
    mainMeals: r.mainMeals,
    suggestionStyle: r.suggestionStyle,
    intermittentFasting: r.intermittentFasting,
    hardest: r.hardest,
    extraGoal: r.extraGoal,
    bmr: r.bmr,
    tdee: r.tdee,
    bmi: n(r.bmi),
    calorieTarget: r.calorieTarget,
    proteinTarget: r.proteinTarget,
    carbsTarget: r.carbsTarget,
    fatTarget: r.fatTarget,
    weeklyRateKg: n(r.weeklyRateKg),
    estimatedWeeks: r.estimatedWeeks,
    onboardingCompleted: r.onboardingCompleted,
  };
}

export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  const rows = await adminDb
    .select({ done: userProfiles.onboardingCompleted })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);
  return rows[0]?.done === true;
}

/**
 * Persist the onboarding answers + the deterministic plan snapshot, marking the
 * profile complete. Runs under the user's RLS context (defense in depth). Upsert
 * so a user re-running the wizard overwrites rather than duplicates.
 */
export async function saveOnboarding(
  user: AppUserRef,
  input: OnboardingInput,
  plan: BodyPlan,
): Promise<void> {
  const values = {
    userId: user.id,
    recordName: input.recordName,
    goal: input.goal,
    method: input.method,
    sex: input.sex,
    age: input.age,
    heightCm: input.heightCm.toString(),
    weightKg: input.weightKg.toString(),
    targetWeightKg: input.targetWeightKg.toString(),
    pace: input.pace,
    activityLevel: input.activityLevel,
    trainingDays: input.trainingDays,
    strengthTraining: input.strengthTraining,
    diet: input.diet,
    measurementUnits: input.measurementUnits,
    mealsPerDay: input.mealsPerDay,
    mainMeals: input.mainMeals,
    suggestionStyle: input.suggestionStyle,
    intermittentFasting: input.intermittentFasting ?? null,
    hardest: input.hardest ?? null,
    extraGoal: input.extraGoal ?? null,
    bmr: plan.bmr,
    tdee: plan.tdee,
    bmi: plan.bmi.value.toString(),
    calorieTarget: plan.calorieTarget,
    proteinTarget: plan.macros.protein,
    carbsTarget: plan.macros.carbs,
    fatTarget: plan.macros.fat,
    weeklyRateKg: plan.weeklyRateKg.toString(),
    estimatedWeeks: plan.estimatedWeeks,
    onboardingCompleted: true,
    updatedAt: new Date(),
  };

  await withUserContext(user.clerkId, async (tx) => {
    await tx
      .insert(userProfiles)
      .values(values)
      .onConflictDoUpdate({ target: userProfiles.userId, set: values });
  });
}
