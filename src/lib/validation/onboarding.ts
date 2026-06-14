import { z } from 'zod';

/**
 * Input boundary for the onboarding wizard. The Server Action receives data
 * already parsed by this schema (CLAUDE.md §10). Ranges mirror the CHECK
 * constraints on `user_profiles` so the DB never rejects a value the form let
 * through, and the deterministic engine always gets physical inputs.
 */

export const goalSchema = z.enum(['lose_fat', 'gain_muscle', 'maintain']);
export const methodSchema = z.enum(['meal_plan', 'count_calories']);
export const sexSchema = z.enum(['male', 'female']);
export const paceSchema = z.enum(['slow', 'recommended', 'fast']);
export const activityLevelSchema = z.enum(['sedentary', 'light', 'active', 'very_active']);
export const dietSchema = z.enum(['recommended', 'high_protein', 'low_carb', 'keto', 'low_fat']);
export const measurementUnitsSchema = z.enum(['metric', 'imperial']);
export const fastingSchema = z.enum(['never', 'tried', 'current', 'want']);
export const suggestionStyleSchema = z.enum(['recipes', 'ingredients', 'mixed']);

export const onboardingSchema = z
  .object({
    recordName: z.string().trim().min(1).max(60),
    goal: goalSchema,
    method: methodSchema,
    sex: sexSchema,
    age: z.number().int().min(14).max(100),
    heightCm: z.number().min(100).max(250),
    weightKg: z.number().min(30).max(350),
    targetWeightKg: z.number().min(30).max(350),
    pace: paceSchema,
    activityLevel: activityLevelSchema,
    trainingDays: z.number().int().min(0).max(7),
    strengthTraining: z.boolean(),
    diet: dietSchema,
    measurementUnits: measurementUnitsSchema,
    // Phase 2: editable plan structure.
    mealsPerDay: z.number().int().min(1).max(8),
    mainMeals: z.number().int().min(1).max(8),
    suggestionStyle: suggestionStyleSchema,
    // Phase 2: available-food selection (catalog food ids).
    foodSelections: z.array(z.string().uuid()).max(300),
    intermittentFasting: fastingSchema.optional(),
    hardest: z.string().trim().max(80).optional(),
    extraGoal: z.string().trim().max(80).optional(),
  })
  .refine((d) => d.mainMeals <= d.mealsPerDay, {
    message: 'mainMeals cannot exceed mealsPerDay',
    path: ['mainMeals'],
  });

export type OnboardingInput = z.infer<typeof onboardingSchema>;
