import { z } from 'zod';

/**
 * Input boundary for meal logging Server Actions. Server Actions receive data
 * already parsed by these schemas (CLAUDE.md §10) — never raw FormData.
 */

export const mealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
export type MealType = z.infer<typeof mealTypeSchema>;

export const mealItemSourceSchema = z.enum([
  'manual',
  'nlp',
  'barcode',
  'recipe',
  'favorite',
]);
export type MealItemSource = z.infer<typeof mealItemSourceSchema>;

export const mealItemInputSchema = z.object({
  foodId: z.string().uuid(),
  quantity: z.number().positive().max(100_000),
  unit: z.string().trim().min(1).max(40),
  source: mealItemSourceSchema,
});

export type MealItemInput = z.infer<typeof mealItemInputSchema>;

export const createMealLogSchema = z.object({
  /** ISO 8601 timestamp; defaults to now() server-side if omitted. */
  loggedAt: z.string().datetime({ offset: true }).optional(),
  mealType: mealTypeSchema,
  notes: z.string().trim().max(500).optional(),
  items: z.array(mealItemInputSchema).min(1).max(50),
});

export type CreateMealLog = z.infer<typeof createMealLogSchema>;

/** Quick single-food log used by the manual logging UI (grams-based). */
export const quickLogSchema = z.object({
  foodId: z.string().uuid(),
  grams: z.number().positive().max(100_000),
  mealType: mealTypeSchema,
});

export type QuickLog = z.infer<typeof quickLogSchema>;
