'use client';

import { useEffect, useState } from 'react';

import { round2 } from '@/lib/nutrition/macros';

import { CalorieRing } from './calorie-ring';

interface MacroBarsProps {
  consumed: { calories: number; protein: number; carbs: number; fat: number };
  goal: { calorieTarget: number; proteinTarget: number; carbsTarget: number; fatTarget: number };
}

interface BarSpec {
  label: string;
  consumed: number;
  target: number;
  unit: string;
  colorVar: string;
}

function pct(consumed: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((consumed / target) * 100));
}

/**
 * Macro progress: an animated calorie ring as the focal point, plus three
 * macro bars that fill from empty on mount with a short stagger so the
 * dashboard cascades into place rather than appearing flat (emil-design-eng:
 * occasional, purposeful motion; staggered entrance). Numbers stay
 * deterministic, sourced from the snapshotted totals.
 */
export function MacroBars({ consumed, goal }: MacroBarsProps) {
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const calRemaining = round2(goal.calorieTarget - consumed.calories);

  const bars: BarSpec[] = [
    {
      label: 'Proteína',
      consumed: consumed.protein,
      target: goal.proteinTarget,
      unit: 'g',
      colorVar: 'var(--color-macro-protein)',
    },
    {
      label: 'Carbohidratos',
      consumed: consumed.carbs,
      target: goal.carbsTarget,
      unit: 'g',
      colorVar: 'var(--color-macro-carbs)',
    },
    {
      label: 'Grasa',
      consumed: consumed.fat,
      target: goal.fatTarget,
      unit: 'g',
      colorVar: 'var(--color-macro-fat)',
    },
  ];

  return (
    <div className="space-y-6">
      <CalorieRing
        consumed={consumed.calories}
        target={goal.calorieTarget}
        remaining={calRemaining}
      />

      <ul className="space-y-3">
        {bars.map((b, i) => {
          const barPct = pct(b.consumed, b.target);
          return (
            <li key={b.label} className="space-y-1.5">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{b.label}</span>
                <span className="text-[var(--color-muted-foreground)] tabular-nums">
                  {Math.round(b.consumed)} / {b.target} {b.unit}
                </span>
              </div>
              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-muted)]"
                role="progressbar"
                aria-valuenow={barPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progreso de ${b.label.toLowerCase()}`}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-700 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
                  style={{
                    width: filled ? `${barPct}%` : '0%',
                    backgroundColor: b.colorVar,
                    transitionDelay: `${i * 80}ms`,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
