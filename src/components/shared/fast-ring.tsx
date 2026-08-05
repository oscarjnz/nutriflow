'use client';

import { fastProgressPct, formatDuration } from '@/lib/fasting/protocol';

interface FastRingProps {
  /** Milliseconds elapsed, recomputed by the parent on every tick. */
  elapsed: number;
  targetHours: number;
  /** Caption under the clock: remaining time, or the overshoot once met. */
  caption: string;
  goalReached: boolean;
}

const SIZE = 208;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Live fasting ring. Mirrors the calorie ring's visual language (same stroke
 * weight, same easing, same gradient construction) so the two hero surfaces of
 * the app read as one system.
 *
 * Two differences are deliberate:
 *  - it does not sweep in on mount, because it updates every second and an
 *    entrance animation would fight the tick;
 *  - reaching the target recolours the arc to primary-solid instead of the
 *    destructive red the calorie ring uses, since overshooting a fast is the
 *    goal, not a warning.
 */
export function FastRing({ elapsed, targetHours, caption, goalReached }: FastRingProps) {
  const pct = fastProgressPct(elapsed, targetHours);
  const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;

  return (
    <div
      className="relative mx-auto flex items-center justify-center"
      style={{ width: SIZE, height: SIZE }}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
        <defs>
          <linearGradient id="fast-arc" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="color-mix(in srgb, var(--color-primary) 62%, white)" />
            <stop offset="100%" stopColor="var(--color-primary)" />
          </linearGradient>
        </defs>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="url(#fast-arc)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{
            filter: `drop-shadow(0 1px 5px color-mix(in srgb, var(--color-primary) ${
              goalReached ? 60 : 40
            }%, transparent))`,
          }}
          className="transition-[stroke-dashoffset] duration-1000 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[2.5rem] font-semibold leading-none tabular-nums tracking-tight">
          {formatDuration(elapsed)}
        </span>
        <span className="text-[var(--color-muted-foreground)] mt-1.5 text-xs">
          objetivo {targetHours} h
        </span>
        <span
          className={`mt-2 text-sm font-medium tabular-nums ${
            goalReached
              ? 'text-[var(--color-primary)]'
              : 'text-[var(--color-muted-foreground)]'
          }`}
        >
          {caption}
        </span>
      </div>

      <span
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progreso del ayuno en curso"
        className="sr-only"
      />
    </div>
  );
}
