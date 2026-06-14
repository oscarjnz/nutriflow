import 'server-only';

import { and, desc, eq } from 'drizzle-orm';

import { type AppDb, withUserContext } from '@/db/client';
import { userGoals } from '@/db/schema';
import type { AppUserRef } from '@/repositories/meal-logs.repo';

/**
 * Daily macro targets. When the user has no active goal yet, the dashboard
 * falls back to DEFAULT_GOAL so it always renders something sensible. A real
 * goals editor lands later; this keeps Sprint 1 self-sufficient.
 */
export interface MacroGoal {
  calorieTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
}

export const DEFAULT_GOAL: MacroGoal = {
  calorieTarget: 2000,
  proteinTarget: 150,
  carbsTarget: 200,
  fatTarget: 67,
};

export async function getActiveGoal(user: AppUserRef): Promise<MacroGoal> {
  const rows = await withUserContext(user.clerkId, (tx: AppDb) =>
    tx
      .select({
        calorieTarget: userGoals.calorieTarget,
        proteinTarget: userGoals.proteinTarget,
        carbsTarget: userGoals.carbsTarget,
        fatTarget: userGoals.fatTarget,
      })
      .from(userGoals)
      .where(and(eq(userGoals.userId, user.id), eq(userGoals.active, true)))
      .orderBy(desc(userGoals.createdAt))
      .limit(1),
  );

  return rows[0] ?? DEFAULT_GOAL;
}
