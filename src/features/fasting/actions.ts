'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/lib/auth/get-user';
import { elapsedMs, formatCompactDuration } from '@/lib/fasting/protocol';
import { startFastSchema } from '@/lib/validation/fasting';
import { cancelFast, endFast, getActiveFast, startFast } from '@/repositories/fasting.repo';

export type FastingActionResult = { ok: true } | { ok: false; error: string };

export type FastingActionResultWith<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * A fast this short is almost always a misfire (double tap, wrong protocol),
 * and closing it would leave a 0-minute row in the history forever. Below this
 * threshold we point the user at Cancel, which discards the session instead.
 */
const MIN_CLOSEABLE_MS = 60_000;

export async function startFastAction(input: unknown): Promise<FastingActionResult> {
  const user = await requireUser();

  const parsed = startFastSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Revisa el protocolo y las horas objetivo.' };
  }

  try {
    const result = await startFast(user, parsed.data);
    if (!result.ok) {
      return { ok: false, error: 'Ya tienes un ayuno en curso.' };
    }
    revalidatePath('/fasting');
    return { ok: true };
  } catch (err: unknown) {
    console.error('startFastAction', err);
    return { ok: false, error: 'No pudimos iniciar el ayuno. Intenta de nuevo.' };
  }
}

export interface EndFastData {
  goalReached: boolean;
  durationLabel: string;
  currentStreak: number;
}

export async function endFastAction(): Promise<FastingActionResultWith<EndFastData>> {
  const user = await requireUser();

  try {
    const active = await getActiveFast(user);
    if (!active) {
      return { ok: false, error: 'No tienes ningún ayuno en curso.' };
    }

    if (elapsedMs(active.startAt) < MIN_CLOSEABLE_MS) {
      return {
        ok: false,
        error: 'Este ayuno acaba de empezar. Usa Cancelar si quieres descartarlo.',
      };
    }

    const result = await endFast(user);
    if (!result) {
      return { ok: false, error: 'No tienes ningún ayuno en curso.' };
    }

    revalidatePath('/fasting');

    const duration = result.session.endAt.getTime() - result.session.startAt.getTime();
    return {
      ok: true,
      data: {
        goalReached: result.session.goalReached,
        durationLabel: formatCompactDuration(duration),
        currentStreak: result.streak.currentCount,
      },
    };
  } catch (err: unknown) {
    console.error('endFastAction', err);
    return { ok: false, error: 'No pudimos cerrar el ayuno. Intenta de nuevo.' };
  }
}

export async function cancelFastAction(): Promise<FastingActionResult> {
  const user = await requireUser();

  try {
    const cancelled = await cancelFast(user);
    if (!cancelled) {
      return { ok: false, error: 'No tienes ningún ayuno en curso.' };
    }
    revalidatePath('/fasting');
    return { ok: true };
  } catch (err: unknown) {
    console.error('cancelFastAction', err);
    return { ok: false, error: 'No pudimos cancelar el ayuno. Intenta de nuevo.' };
  }
}
