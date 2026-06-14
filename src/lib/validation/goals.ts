import { z } from 'zod';

/**
 * Macro goal input. Targets are whole numbers within sane human ranges so a
 * typo can't persist a 99999-kcal goal. Calories are validated independently
 * of macros (the user may set them directly), but the UI surfaces the Atwater
 * estimate as a cross-check.
 */
export const setGoalSchema = z.object({
  calorieTarget: z.number().int().min(500).max(10_000),
  proteinTarget: z.number().int().min(0).max(1000),
  carbsTarget: z.number().int().min(0).max(2000),
  fatTarget: z.number().int().min(0).max(1000),
});

export type SetGoal = z.infer<typeof setGoalSchema>;
