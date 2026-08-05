import { describe, expect, it } from 'vitest';

import {
  displayedStreak,
  EMPTY_STREAK,
  nextFastingStreak,
  previousDateKey,
  toDateKey,
  type StreakState,
} from '@/lib/fasting/streak';

function state(current: number, longest: number, last: string | null): StreakState {
  return { currentCount: current, longestCount: longest, lastLoggedDate: last };
}

describe('toDateKey', () => {
  it('formats the local calendar day zero-padded', () => {
    expect(toDateKey(new Date(2026, 7, 5, 23, 30))).toBe('2026-08-05');
    expect(toDateKey(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });

  it('uses the local day, not the UTC one, for a late-evening timestamp', () => {
    const localLateEvening = new Date(2026, 7, 5, 22, 0);
    expect(toDateKey(localLateEvening)).toBe('2026-08-05');
  });
});

describe('previousDateKey', () => {
  it('steps back one day', () => {
    expect(previousDateKey('2026-08-05')).toBe('2026-08-04');
  });

  it('crosses month and year boundaries', () => {
    expect(previousDateKey('2026-08-01')).toBe('2026-07-31');
    expect(previousDateKey('2026-01-01')).toBe('2025-12-31');
  });

  it('handles a leap day', () => {
    expect(previousDateKey('2028-03-01')).toBe('2028-02-29');
  });

  it('rejects a malformed key instead of returning a silent NaN date', () => {
    expect(() => previousDateKey('05-08-2026')).toThrow(RangeError);
  });
});

describe('nextFastingStreak', () => {
  it('starts a streak at 1 from empty', () => {
    expect(nextFastingStreak(EMPTY_STREAK, '2026-08-05')).toEqual(
      state(1, 1, '2026-08-05'),
    );
  });

  it('extends on the following day', () => {
    expect(nextFastingStreak(state(3, 5, '2026-08-04'), '2026-08-05')).toEqual(
      state(4, 5, '2026-08-05'),
    );
  });

  it('raises the record once the current streak passes it', () => {
    expect(nextFastingStreak(state(5, 5, '2026-08-04'), '2026-08-05')).toEqual(
      state(6, 6, '2026-08-05'),
    );
  });

  it('restarts at 1 after a gap, keeping the record', () => {
    expect(nextFastingStreak(state(9, 9, '2026-08-01'), '2026-08-05')).toEqual(
      state(1, 9, '2026-08-05'),
    );
  });

  it('does not count a second fast completed on the same day', () => {
    const before = state(4, 7, '2026-08-05');
    expect(nextFastingStreak(before, '2026-08-05')).toBe(before);
  });

  it('ignores an out-of-order completion older than the last one', () => {
    const before = state(4, 7, '2026-08-05');
    expect(nextFastingStreak(before, '2026-08-02')).toBe(before);
  });

  it('extends across a month boundary', () => {
    expect(nextFastingStreak(state(2, 2, '2026-07-31'), '2026-08-01')).toEqual(
      state(3, 3, '2026-08-01'),
    );
  });

  it('rejects a malformed completion date', () => {
    expect(() => nextFastingStreak(EMPTY_STREAK, 'ayer')).toThrow(RangeError);
  });
});

describe('displayedStreak', () => {
  it('is zero when nothing was ever completed', () => {
    expect(displayedStreak(EMPTY_STREAK, '2026-08-05')).toBe(0);
  });

  it('shows the stored count when the last fast was today', () => {
    expect(displayedStreak(state(4, 9, '2026-08-05'), '2026-08-05')).toBe(4);
  });

  it('keeps the streak alive when the last fast was yesterday', () => {
    expect(displayedStreak(state(4, 9, '2026-08-04'), '2026-08-05')).toBe(4);
  });

  it('reports zero once a full day was skipped, even though the row still holds the old count', () => {
    expect(displayedStreak(state(4, 9, '2026-08-03'), '2026-08-05')).toBe(0);
  });
});
