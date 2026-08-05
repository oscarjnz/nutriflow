import { describe, expect, it } from 'vitest';

import {
  elapsedMs,
  fastProgressPct,
  fastingPhaseAt,
  formatCompactDuration,
  formatDuration,
  durationMs,
  isGoalReached,
  MS_PER_HOUR,
  overshootMs,
  PROTOCOL_PRESETS,
  remainingMs,
  targetHoursForProtocol,
  targetReachedAt,
} from '@/lib/fasting/protocol';

const START = new Date('2026-08-05T08:00:00.000Z');

function hoursAfterStart(hours: number): Date {
  return new Date(START.getTime() + hours * MS_PER_HOUR);
}

describe('targetHoursForProtocol', () => {
  it('returns the fasting half of each preset ratio', () => {
    expect(targetHoursForProtocol('12:12')).toBe(12);
    expect(targetHoursForProtocol('16:8')).toBe(16);
    expect(targetHoursForProtocol('20:4')).toBe(20);
  });

  it('returns null for custom, which carries no fixed target', () => {
    expect(targetHoursForProtocol('custom')).toBeNull();
  });

  it('keeps every preset consistent with the ratio in its label', () => {
    for (const preset of PROTOCOL_PRESETS) {
      const fastingHalf = Number(preset.label.split(':')[0]);
      expect(preset.targetHours).toBe(fastingHalf);
    }
  });
});

describe('elapsedMs', () => {
  it('measures forward from the start', () => {
    expect(elapsedMs(START, hoursAfterStart(3))).toBe(3 * MS_PER_HOUR);
  });

  it('clamps at zero when the clock is behind the start', () => {
    expect(elapsedMs(START, hoursAfterStart(-2))).toBe(0);
  });
});

describe('durationMs', () => {
  it('uses end_at for a finished fast and ignores now', () => {
    expect(durationMs(START, hoursAfterStart(16), hoursAfterStart(40))).toBe(16 * MS_PER_HOUR);
  });

  it('falls back to now for an open fast', () => {
    expect(durationMs(START, null, hoursAfterStart(5))).toBe(5 * MS_PER_HOUR);
  });
});

describe('fastProgressPct', () => {
  it('is proportional before the target', () => {
    expect(fastProgressPct(8 * MS_PER_HOUR, 16)).toBe(50);
  });

  it('caps at 100 so the ring never overdraws', () => {
    expect(fastProgressPct(30 * MS_PER_HOUR, 16)).toBe(100);
  });

  it('is zero for a non-positive target instead of dividing by zero', () => {
    expect(fastProgressPct(MS_PER_HOUR, 0)).toBe(0);
  });

  it('never returns a negative percentage', () => {
    expect(fastProgressPct(-MS_PER_HOUR, 16)).toBe(0);
  });
});

describe('remainingMs and overshootMs', () => {
  it('counts down to the target', () => {
    expect(remainingMs(10 * MS_PER_HOUR, 16)).toBe(6 * MS_PER_HOUR);
  });

  it('reports no remaining time once the target is met', () => {
    expect(remainingMs(20 * MS_PER_HOUR, 16)).toBe(0);
  });

  it('reports overshoot only past the target', () => {
    expect(overshootMs(10 * MS_PER_HOUR, 16)).toBe(0);
    expect(overshootMs(18 * MS_PER_HOUR, 16)).toBe(2 * MS_PER_HOUR);
  });
});

describe('isGoalReached', () => {
  it('is false one millisecond short and true exactly on the target', () => {
    expect(isGoalReached(16 * MS_PER_HOUR - 1, 16)).toBe(false);
    expect(isGoalReached(16 * MS_PER_HOUR, 16)).toBe(true);
  });
});

describe('formatDuration', () => {
  it('pads minutes and seconds but not hours', () => {
    expect(formatDuration(0)).toBe('0:00:00');
    expect(formatDuration(3 * MS_PER_HOUR + 4 * 60_000 + 5_000)).toBe('3:04:05');
  });

  it('lets hours grow past two digits for a long fast', () => {
    expect(formatDuration(100 * MS_PER_HOUR)).toBe('100:00:00');
  });

  it('truncates instead of rounding, so a second never shows early', () => {
    expect(formatDuration(1999)).toBe('0:00:01');
  });

  it('never renders negative time', () => {
    expect(formatDuration(-5000)).toBe('0:00:00');
  });
});

describe('formatCompactDuration', () => {
  it('drops the hour part below one hour', () => {
    expect(formatCompactDuration(45 * 60_000)).toBe('45 min');
  });

  it('drops the minute part on a whole hour', () => {
    expect(formatCompactDuration(2 * MS_PER_HOUR)).toBe('2 h');
  });

  it('shows both parts otherwise', () => {
    expect(formatCompactDuration(16 * MS_PER_HOUR + 4 * 60_000)).toBe('16 h 4 min');
  });
});

describe('fastingPhaseAt', () => {
  it('starts in digestion', () => {
    expect(fastingPhaseAt(0).key).toBe('digestion');
    expect(fastingPhaseAt(3 * MS_PER_HOUR).key).toBe('digestion');
  });

  it('moves phase exactly at each boundary', () => {
    expect(fastingPhaseAt(4 * MS_PER_HOUR).key).toBe('glycogen');
    expect(fastingPhaseAt(12 * MS_PER_HOUR).key).toBe('transition');
    expect(fastingPhaseAt(16 * MS_PER_HOUR).key).toBe('ketosis');
    expect(fastingPhaseAt(24 * MS_PER_HOUR).key).toBe('extended');
  });

  it('stays in the last phase for very long fasts', () => {
    expect(fastingPhaseAt(72 * MS_PER_HOUR).key).toBe('extended');
  });

  it('falls back to the first phase for a negative elapsed value', () => {
    expect(fastingPhaseAt(-MS_PER_HOUR).key).toBe('digestion');
  });
});

describe('targetReachedAt', () => {
  it('projects the finish line from the start', () => {
    expect(targetReachedAt(START, 16).toISOString()).toBe('2026-08-06T00:00:00.000Z');
  });
});
