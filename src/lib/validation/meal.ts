import { z } from 'zod';

/**
 * Input boundary for meal logging Server Actions. Server Actions receive data
 * already parsed by these schemas (CLAUDE.md §10) - never raw FormData.
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
  /** Defaults to 'manual' (prepareMealItem's default) when omitted - the web
   * client never sends this; Flutter's NLP-driven logging screen sends 'nlp'. */
  source: mealItemSourceSchema.optional(),
});

export type QuickLog = z.infer<typeof quickLogSchema>;

/**
 * Several foods logged as ONE meal. Same grams-based shape as `quickLogSchema`
 * minus `mealType`, which belongs to the meal and not to each food in it.
 */
export const quickLogItemSchema = quickLogSchema.omit({ mealType: true });

export const quickLogBatchSchema = z.object({
  mealType: mealTypeSchema,
  items: z.array(quickLogItemSchema).min(1).max(50),
});

export type QuickLogBatch = z.infer<typeof quickLogBatchSchema>;

/**
 * What `logMealAction` accepts. The single-food shape is the original one and
 * stays supported: the web UI sends it, and so do the mobile builds already
 * installed on people's phones (v0.1.3 and earlier).
 */
export const quickLogInputSchema = z.union([quickLogBatchSchema, quickLogSchema]);
