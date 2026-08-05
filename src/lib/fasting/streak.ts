/**
 * Deterministic streak arithmetic for `user_streaks`.
 *
 * A streak is calendar-day based, not 24h based: what counts is whether the
 * user completed a qualifying fast on consecutive local days. Dates are handled
 * as `YYYY-MM-DD` keys rather than Date objects so the arithmetic is immune to
 * timezone and DST shifts - adding a day to a Date at a DST boundary can land
 * on the same calendar day, which would silently break a streak.
 */

export interface StreakState {
  currentCount: number;
  longestCount: number;
  /** `YYYY-MM-DD`, or null when the user has never completed a fast. */
  lastLoggedDate: string | null;
}

export const EMPTY_STREAK: StreakState = {
  currentCount: 0,
  longestCount: 0,
  lastLoggedDate: null,
};

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Local calendar day of `date` as a `YYYY-MM-DD` key. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function assertDateKey(key: string, argName: string): void {
  if (!DATE_KEY.test(key)) {
    throw new RangeError(`${argName} must be a YYYY-MM-DD date key, got "${key}"`);
  }
}

/**
 * The calendar day before `key`. Computed in UTC on purpose: the key carries no
 * time-of-day, so UTC arithmetic on midnight is exact and never crosses a DST
 * transition the way local-time arithmetic can.
 */
export function previousDateKey(key: string): string {
  assertDateKey(key, 'key');
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  const day = Number(key.slice(8, 10));
  const previous = new Date(Date.UTC(year, month - 1, day - 1));
  return previous.toISOString().slice(0, 10);
}

/**
 * Streak after a qualifying fast completed on `completedOn`.
 *
 * Rules, in order:
 *  - same day as the last one already counted: nothing changes (a second fast
 *    in one day must not inflate the streak)
 *  - the day right after: the streak extends
 *  - any earlier day (a late or out-of-order completion): nothing changes, so a
 *    backfill can never rewrite history downward
 *  - any later gap: the streak restarts at 1
 *
 * `longestCount` is monotonic and only ever moves up.
 */
export function nextFastingStreak(state: StreakState, completedOn: string): StreakState {
  assertDateKey(completedOn, 'completedOn');

  const { lastLoggedDate } = state;

  if (lastLoggedDate !== null) {
    assertDateKey(lastLoggedDate, 'state.lastLoggedDate');
    if (completedOn <= lastLoggedDate) return state;
  }

  const extends_ = lastLoggedDate !== null && previousDateKey(completedOn) === lastLoggedDate;
  const currentCount = extends_ ? state.currentCount + 1 : 1;

  return {
    currentCount,
    longestCount: Math.max(state.longestCount, currentCount),
    lastLoggedDate: completedOn,
  };
}

/**
 * The streak as it should be *displayed* today. A stored `currentCount` goes
 * stale the moment a day passes without a completed fast, so reading the raw
 * row would show a streak the user no longer has. Yesterday still counts as
 * alive: the day is not over yet.
 */
export function displayedStreak(state: StreakState, today: string): number {
  assertDateKey(today, 'today');
  if (state.lastLoggedDate === null) return 0;
  assertDateKey(state.lastLoggedDate, 'state.lastLoggedDate');

  if (state.lastLoggedDate >= today) return state.currentCount;
  if (state.lastLoggedDate === previousDateKey(today)) return state.currentCount;
  return 0;
}
