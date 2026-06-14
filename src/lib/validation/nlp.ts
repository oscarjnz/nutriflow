import { z } from 'zod';

/**
 * Contract for the LLM's structured output.
 *
 * Per CLAUDE.md §2/§6 the model's ONLY job is interpretation: pull food
 * mentions out of free text, normalize the name, and guess quantity/unit. It
 * never returns nutritional values and never decides which catalog row wins -
 * that ranking is deterministic TypeScript against `foods` + `food_aliases`.
 *
 * If the model's JSON fails this schema, the result is discarded and the UI
 * falls back to manual entry (never a partial/guessed parse).
 */

export const extractedFoodSchema = z.object({
  /** Original span as written by the user, e.g. "dos huevos fritos". */
  raw: z.string().min(1).max(200),
  /** Spanish normalized name, e.g. "huevo frito". */
  name: z.string().min(1).max(120),
  /** English normalization hint to improve catalog matching ("fried egg"). */
  nameEn: z.string().min(1).max(120).nullish(),
  /** Quantity in `unit`s; the model infers "dos" -> 2, "media" -> 0.5. */
  quantity: z.number().positive().max(10_000),
  /** Free-text unit; resolved to grams later by `lib/nutrition/units.ts`. */
  unit: z.string().min(1).max(40),
  /** Search terms for the deterministic catalog lookup. */
  queryTerms: z.array(z.string().min(1).max(60)).min(1).max(8),
});

export type ExtractedFood = z.infer<typeof extractedFoodSchema>;

export const parseResponseSchema = z.object({
  items: z.array(extractedFoodSchema).max(20),
});

export type ParseResponse = z.infer<typeof parseResponseSchema>;

/** Input boundary for `parseFoodInput`. */
export const parseFoodInputSchema = z.object({
  text: z.string().trim().min(1).max(500),
});

export type ParseFoodInput = z.infer<typeof parseFoodInputSchema>;

/**
 * A ranked catalog candidate produced by deterministic search, paired with the
 * model's extracted quantity/unit. This is what the UI consumes.
 */
export const foodCandidateSchema = z.object({
  foodId: z.string().uuid(),
  nameEs: z.string(),
  nameEn: z.string(),
  /** 0..1 relevance from tsvector rank + trigram similarity. */
  score: z.number().min(0).max(1),
  /** How the row was matched, for debugging and UI affordances. */
  matchedVia: z.enum(['name', 'alias', 'trigram']),
});

export type FoodCandidate = z.infer<typeof foodCandidateSchema>;

export const parsedItemSchema = z.object({
  extracted: extractedFoodSchema,
  candidates: z.array(foodCandidateSchema),
});

export type ParsedItem = z.infer<typeof parsedItemSchema>;

export const parseFoodResultSchema = z.object({
  items: z.array(parsedItemSchema),
  /** True when served from `nlp_cache` rather than a fresh Groq call. */
  cached: z.boolean(),
  model: z.string(),
});

export type ParseFoodResult = z.infer<typeof parseFoodResultSchema>;
