import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { requireUser } from '@/lib/auth/get-user';
import {
  getSelectedFoodIds,
  listSelectableFoods,
} from '@/repositories/user-food-selections.repo';
import { getProfile } from '@/repositories/user-profile.repo';

import { OnboardingClient, type OnboardingDefaults } from './onboarding-client';

export const metadata: Metadata = { title: 'Bienvenido a NutriFlow' };

export default async function OnboardingPage() {
  const user = await requireUser();
  const [profile, selectableFoods, selectedFoodIds] = await Promise.all([
    getProfile(user.id),
    listSelectableFoods(),
    getSelectedFoodIds(user),
  ]);

  // Already onboarded: nothing to do here, send them home.
  if (profile?.onboardingCompleted) redirect('/');

  // Pre-fill from a partial/previous run so re-entry is not from scratch.
  const defaults: OnboardingDefaults = {
    recordName: user.displayName ?? '',
    selectableFoods,
    selectedFoodIds,
    answers: profile
      ? {
          goal: profile.goal,
          method: profile.method,
          sex: profile.sex,
          age: profile.age,
          heightCm: profile.heightCm,
          weightKg: profile.weightKg,
          targetWeightKg: profile.targetWeightKg,
          pace: profile.pace,
          activityLevel: profile.activityLevel,
          trainingDays: profile.trainingDays,
          strengthTraining: profile.strengthTraining,
          diet: profile.diet,
          measurementUnits: profile.measurementUnits,
          mealsPerDay: profile.mealsPerDay,
          mainMeals: profile.mainMeals,
          suggestionStyle: profile.suggestionStyle ?? 'mixed',
          intermittentFasting: profile.intermittentFasting ?? 'never',
          recordName: profile.recordName ?? user.displayName ?? '',
        }
      : {},
  };

  return <OnboardingClient defaults={defaults} />;
}
