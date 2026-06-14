'use client';

import { useEffect, useState } from 'react';

import { useCountUp } from '@/hooks/use-count-up';

interface CalorieRingProps {
  consumed: number;
  target: number;
  remaining: number;
}

const SIZE = 184;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Calorie focal point: an animated progress ring that fills from empty on
 * mount and a calorie figure that counts up to today's total. The ring is the
 * hero of the dashboard, seen on every open, so the motion runs once per load
 * with a strong ease-out (occasional, purposeful) and disables under
 * prefers-reduced-motion. Color flips to destructive when over target.
 */
export function CalorieRing({ consumed, target, remaining }: CalorieRingProps) {
  const pct = target > 0 ? Math.min(100, (consumed / target) * 100) : 0;
  const over = remaining < 0;
  const shown = useCountUp(Math.round(consumed));

  // Start the arc empty, then transition to the real fill after first paint so
  // the ring visibly sweeps in rather than appearing already complete.
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const offset = CIRCUMFERENCE - ((filled ? pct : 0) / 100) * CIRCUMFERENCE;
  const stroke = over ? 'var(--color-destructive)' : 'url(#calorie-arc)';
  const glow = over ? 'var(--color-destructive)' : 'var(--color-primary)';

  return (
    <div
      className="relative mx-auto flex items-center justify-center"
      style={{ width: SIZE, height: SIZE }}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
        <defs>
          <linearGradient id="calorie-arc" x1="0%" y1="0%" x2="100%" y2="100%">
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
          stroke={stroke}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 1px 5px color-mix(in srgb, ${glow} 40%, transparent))` }}
          className="transition-[stroke-dashoffset,stroke] duration-[900ms] [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[2.75rem] font-semibold leading-none tabular-nums tracking-tight">
          {Math.round(shown)}
        </span>
        <span className="text-[var(--color-muted-foreground)] mt-1 text-xs">de {target} kcal</span>
        <span
          className={`mt-2 text-sm font-medium tabular-nums ${
            over ? 'text-[var(--color-destructive)]' : 'text-[var(--color-primary)]'
          }`}
        >
          {over ? `${Math.round(-remaining)} de más` : `${Math.round(remaining)} restantes`}
        </span>
      </div>

      <span
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progreso de calorías de hoy"
        className="sr-only"
      />
    </div>
  );
}
