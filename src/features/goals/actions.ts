'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/lib/auth/get-user';
import { setGoalSchema } from '@/lib/validation/goals';
import { setGoal } from '@/repositories/user-goals.repo';

export type SaveGoalResult = { ok: true } | { ok: false; error: string };

export async function saveGoalAction(input: unknown): Promise<SaveGoalResult> {
  const user = await requireUser();

  const parsed = setGoalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Revisa los valores de tus metas.' };
  }

  try {
    await setGoal(user, parsed.data);
    revalidatePath('/');
    revalidatePath('/goals');
    return { ok: true };
  } catch (err: unknown) {
    console.error('saveGoalAction', err);
    return { ok: false, error: 'No pudimos guardar tus metas. Intenta de nuevo.' };
  }
}
