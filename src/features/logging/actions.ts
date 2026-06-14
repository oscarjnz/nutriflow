'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/lib/auth/get-user';
import { quickLogSchema } from '@/lib/validation/meal';
import { type FoodSearchResult, searchFoods } from '@/repositories/foods.repo';
import { createMealLog, setMealItemDeleted } from '@/repositories/meal-logs.repo';

import { prepareMealItem } from './prepare-item';

export type SearchFoodsResult =
  | { ok: true; foods: FoodSearchResult[] }
  | { ok: false; error: string };

export async function searchFoodsAction(query: string): Promise<SearchFoodsResult> {
  await requireUser();
  const q = query.trim();
  if (q.length === 0) return { ok: true, foods: [] };
  try {
    const foods = await searchFoods(q);
    return { ok: true, foods };
  } catch (err: unknown) {
    console.error('searchFoodsAction', err);
    return { ok: false, error: 'No pudimos buscar alimentos. Intenta de nuevo.' };
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
