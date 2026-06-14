'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/lib/auth/get-user';
import { searchOffProducts } from '@/lib/off/client';
import { barcodeSchema } from '@/lib/validation/barcode';
import { quickLogSchema } from '@/lib/validation/meal';
import {
  findOrImportByBarcode,
  type FoodSearchResult,
  getFoodResultById,
  offFoodToResult,
  searchFoods,
} from '@/repositories/foods.repo';
import { createMealLog, setMealItemDeleted } from '@/repositories/meal-logs.repo';

import { prepareMealItem } from './prepare-item';

/** Below this many local hits, we widen the search to OFF's live catalog. */
const OFF_FALLBACK_THRESHOLD = 6;
const TOTAL_RESULT_CAP = 12;

export type SearchFoodsResult =
  | { ok: true; foods: FoodSearchResult[] }
  | { ok: false; error: string };

export async function searchFoodsAction(query: string): Promise<SearchFoodsResult> {
  await requireUser();
  const q = query.trim();
  if (q.length === 0) return { ok: true, foods: [] };
  try {
    const local = await searchFoods(q);

    // The local catalog is small (curated seed); when it can't satisfy the
    // query, fall back to OFF's full database. Local always ranks first and OFF
    // failures degrade gracefully — the user still sees local matches.
    if (local.length >= OFF_FALLBACK_THRESHOLD || q.length < 3) {
      return { ok: true, foods: local };
    }

    const localBarcodes = new Set(local.map((f) => f.barcode).filter(Boolean));
    let external: FoodSearchResult[] = [];
    try {
      const off = await searchOffProducts(q, TOTAL_RESULT_CAP - local.length);
      external = off
        .filter((p) => !localBarcodes.has(p.barcode))
        .map(offFoodToResult);
    } catch (offErr: unknown) {
      console.error('searchFoodsAction: OFF fallback failed', offErr);
    }

    return { ok: true, foods: [...local, ...external] };
  } catch (err: unknown) {
    console.error('searchFoodsAction', err);
    return { ok: false, error: 'No pudimos buscar alimentos. Intenta de nuevo.' };
  }
}

export type BarcodeLookupResult =
  | { ok: true; food: FoodSearchResult }
  | { ok: false; error: string };

/**
 * Resolve a typed-in barcode to a loggable food, importing from OFF on miss.
 * Returns the persisted local food so the UI can log it on the normal path.
 */
export async function lookupBarcodeAction(rawBarcode: string): Promise<BarcodeLookupResult> {
  await requireUser();
  const parsed = barcodeSchema.safeParse(rawBarcode);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Código inválido.' };
  }
  try {
    const foodId = await findOrImportByBarcode(parsed.data);
    if (!foodId) {
      return { ok: false, error: 'Ese código no está en Open Food Facts.' };
    }
    const food = await getFoodResultById(foodId);
    if (!food) {
      return { ok: false, error: 'No pudimos cargar el producto.' };
    }
    return { ok: true, food };
  } catch (err: unknown) {
    console.error('lookupBarcodeAction', err);
    return { ok: false, error: 'No pudimos consultar el código. Intenta de nuevo.' };
  }
}

export type LogMealResult = { ok: true } | { ok: false; error: string };

export async function logMealAction(input: unknown): Promise<LogMealResult> {
  const user = await requireUser();

  const parsed = quickLogSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Datos de registro inválidos.' };
  }

  try {
    const item = await prepareMealItem(parsed.data.foodId, parsed.data.grams);
    await createMealLog(user, {
      mealType: parsed.data.mealType,
      loggedAt: new Date(),
      items: [item],
    });
    revalidatePath('/');
    return { ok: true };
  } catch (err: unknown) {
    console.error('logMealAction', err);
    return { ok: false, error: 'No pudimos registrar la comida. Intenta de nuevo.' };
  }
}

const importLogSchema = quickLogSchema
  .omit({ foodId: true })
  .extend({ barcode: barcodeSchema });

/**
 * Log an Open Food Facts product selected from search. Imports it into the
 * catalog first (lazy persistence — only foods the user logs get stored) then
 * records the meal item with `barcode` provenance.
 */
export async function importAndLogMealAction(input: unknown): Promise<LogMealResult> {
  const user = await requireUser();

  const parsed = importLogSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Datos de registro inválidos.' };
  }

  try {
    const foodId = await findOrImportByBarcode(parsed.data.barcode);
    if (!foodId) {
      return { ok: false, error: 'Ese producto ya no está disponible en Open Food Facts.' };
    }
    const item = await prepareMealItem(foodId, parsed.data.grams, 'barcode');
    await createMealLog(user, {
      mealType: parsed.data.mealType,
      loggedAt: new Date(),
      items: [item],
    });
    revalidatePath('/');
    return { ok: true };
  } catch (err: unknown) {
    console.error('importAndLogMealAction', err);
    return { ok: false, error: 'No pudimos registrar el producto. Intenta de nuevo.' };
  }
}

export type EntryMutationResult = { ok: true } | { ok: false; error: string };

export async function deleteEntryAction(mealItemId: string): Promise<EntryMutationResult> {
  const user = await requireUser();
  try {
    await setMealItemDeleted(user, mealItemId, true);
    revalidatePath('/');
    return { ok: true };
  } catch (err: unknown) {
    console.error('deleteEntryAction', err);
    return { ok: false, error: 'No pudimos eliminar la comida.' };
  }
}

export async function restoreEntryAction(mealItemId: string): Promise<EntryMutationResult> {
  const user = await requireUser();
  try {
    await setMealItemDeleted(user, mealItemId, false);
    revalidatePath('/');
    return { ok: true };
  } catch (err: unknown) {
    console.error('restoreEntryAction', err);
    return { ok: false, error: 'No pudimos restaurar la comida.' };
  }
}
