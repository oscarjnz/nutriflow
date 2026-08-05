import 'server-only';

import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';

import { type AppDb, withUserContext } from '@/db/client';
import { fastingSessions, userStreaks } from '@/db/schema';
import { newId } from '@/lib/crypto/uuid';
import { isGoalReached, type FastingProtocol } from '@/lib/fasting/protocol';
import {
  EMPTY_STREAK,
  nextFastingStreak,
  toDateKey,
  type StreakState,
} from '@/lib/fasting/streak';
import type { StartFast } from '@/lib/validation/fasting';
import type { AppUserRef } from '@/repositories/meal-logs.repo';

/**
 * Fasting session persistence.
 *
 * Every method runs inside `withUserContext`, so RLS is active under the
 * `authenticated` role on top of the explicit `user_id` predicates.
 *
 * Two invariants are enforced by the database rather than by application code,
 * which is why the mutations below can stay this small:
 *  - `fasting_active_per_user`, a unique partial index on `(user_id) where
 *    end_at is null and deleted_at is null`, makes a second concurrent start
 *    fail with 23505 instead of leaving two open fasts to reconcile.
 *  - `check (end_at is null or end_at > start_at)` rejects a zero-length fast.
 */

export const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === UNIQUE_VIOLATION
  );
}

export interface ActiveFast {
  id: string;
  startAt: Date;
  targetHours: number;
  protocol: FastingProtocol;
}

export interface CompletedFast {
  id: string;
  startAt: Date;
  endAt: Date;
  targetHours: number;
  protocol: FastingProtocol;
  goalReached: boolean;
}

export async function getActiveFast(user: AppUserRef): Promise<ActiveFast | null> {
  const rows = await withUserContext(user.clerkId, (tx: AppDb) =>
    tx
      .select({
        id: fastingSessions.id,
        startAt: fastingSessions.startAt,
        targetHours: fastingSessions.targetHours,
        protocol: fastingSessions.protocol,
      })
      .from(fastingSessions)
      .where(
        and(
          eq(fastingSessions.userId, user.id),
          isNull(fastingSessions.endAt),
          isNull(fastingSessions.deletedAt),
        ),
      )
      .limit(1),
  );

  return rows[0] ?? null;
}

export type StartFastResult =
  | { ok: true; id: string; startAt: Date }
  | { ok: false; reason: 'already_active' };

/**
 * Open a new fast. Returns `already_active` rather than throwing when one is
 * already running, because that is a normal outcome of a stale tab hitting the
 * button twice, not an exceptional condition.
 */
export async function startFast(user: AppUserRef, input: StartFast): Promise<StartFastResult> {
  const id = newId();
  const startAt = new Date();

  try {
    await withUserContext(user.clerkId, (tx: AppDb) =>
      tx.insert(fastingSessions).values({
        id,
        userId: user.id,
        startAt,
        targetHours: input.targetHours,
        protocol: input.protocol,
      }),
    );
  } catch (error: unknown) {
    if (isUniqueViolation(error)) return { ok: false, reason: 'already_active' };
    throw error;
  }

  return { ok: true, id, startAt };
}

export interface EndFastResult {
  session: CompletedFast;
  /** Streak after this fast, already persisted. */
  streak: StreakState;
}

/**
 * Close the running fast and, when it met its target, advance the fasting
 * streak in the same transaction.
 *
 * The update is its own guard: `where end_at is null` means two concurrent
 * calls cannot both close the session, so the streak can only ever be advanced
 * once per fast. Returns null when there was nothing open to close.
 */
export async function endFast(user: AppUserRef, endAt: Date = new Date()): Promise<EndFastResult | null> {
  return withUserContext(user.clerkId, async (tx: AppDb) => {
    const closed = await tx
      .update(fastingSessions)
      .set({ endAt })
      .where(
        and(
          eq(fastingSessions.userId, user.id),
          isNull(fastingSessions.endAt),
          isNull(fastingSessions.deletedAt),
        ),
      )
      .returning({
        id: fastingSessions.id,
        startAt: fastingSessions.startAt,
        endAt: fastingSessions.endAt,
        targetHours: fastingSessions.targetHours,
        protocol: fastingSessions.protocol,
      });

    const row = closed[0];
    if (!row || row.endAt === null) return null;

    const elapsed = row.endAt.getTime() - row.startAt.getTime();
    const goalReached = isGoalReached(elapsed, row.targetHours);

    const session: CompletedFast = {
      id: row.id,
      startAt: row.startAt,
      endAt: row.endAt,
      targetHours: row.targetHours,
      protocol: row.protocol,
      goalReached,
    };

    if (!goalReached) {
      return { session, streak: await readStreak(tx, user.id) };
    }

    const current = await readStreak(tx, user.id);
    const next = nextFastingStreak(current, toDateKey(row.endAt));

    await tx
      .insert(userStreaks)
      .values({
        userId: user.id,
        streakType: 'fasting',
        currentCount: next.currentCount,
        longestCount: next.longestCount,
        lastLoggedDate: next.lastLoggedDate,
      })
      .onConflictDoUpdate({
        target: [userStreaks.userId, userStreaks.streakType],
        set: {
          currentCount: next.currentCount,
          longestCount: next.longestCount,
          lastLoggedDate: next.lastLoggedDate,
        },
      });

    return { session, streak: next };
  });
}

/**
 * Discard the running fast. Soft delete, so the row stays for a future sync or
 * audit but is invisible to history and frees the active-session slot.
 */
export async function cancelFast(user: AppUserRef): Promise<boolean> {
  const cancelled = await withUserContext(user.clerkId, (tx: AppDb) =>
    tx
      .update(fastingSessions)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(fastingSessions.userId, user.id),
          isNull(fastingSessions.endAt),
          isNull(fastingSessions.deletedAt),
        ),
      )
      .returning({ id: fastingSessions.id }),
  );

  return cancelled.length > 0;
}

/** Finished fasts, newest first, for the history list. */
export async function getRecentFasts(user: AppUserRef, limit = 10): Promise<CompletedFast[]> {
  const rows = await withUserContext(user.clerkId, (tx: AppDb) =>
    tx
      .select({
        id: fastingSessions.id,
        startAt: fastingSessions.startAt,
        endAt: fastingSessions.endAt,
        targetHours: fastingSessions.targetHours,
        protocol: fastingSessions.protocol,
      })
      .from(fastingSessions)
      .where(
        and(
          eq(fastingSessions.userId, user.id),
          isNotNull(fastingSessions.endAt),
          isNull(fastingSessions.deletedAt),
        ),
      )
      .orderBy(desc(fastingSessions.startAt))
      .limit(limit),
  );

  return rows.flatMap((row) => {
    if (row.endAt === null) return [];
    return [
      {
        id: row.id,
        startAt: row.startAt,
        endAt: row.endAt,
        targetHours: row.targetHours,
        protocol: row.protocol,
        goalReached: isGoalReached(row.endAt.getTime() - row.startAt.getTime(), row.targetHours),
      },
    ];
  });
}

async function readStreak(tx: AppDb, userId: string): Promise<StreakState> {
  const rows = await tx
    .select({
      currentCount: userStreaks.currentCount,
      longestCount: userStreaks.longestCount,
      lastLoggedDate: userStreaks.lastLoggedDate,
    })
    .from(userStreaks)
    .where(and(eq(userStreaks.userId, userId), eq(userStreaks.streakType, 'fasting')))
    .limit(1);

  return rows[0] ?? EMPTY_STREAK;
}

export async function getFastingStreak(user: AppUserRef): Promise<StreakState> {
  return withUserContext(user.clerkId, (tx: AppDb) => readStreak(tx, user.id));
}
