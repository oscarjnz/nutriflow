import { round2 } from '@/lib/nutrition/macros';

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
 * Macro progress: a calorie focal number with a ring-like remaining figure,
 * plus three macro bars. Bars fill with a strong ease-out so the dashboard
 * feels alive on load without being distracting (emil-design-eng: occasional,
 * purposeful motion).
 */
export function MacroBars({ consumed, goal }: MacroBarsProps) {
  const calRemaining = round2(goal.calorieTarget - consumed.calories);
  const calPct = pct(consumed.calories, goal.calorieTarget);

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
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[var(--color-muted-foreground)] text-sm">Calorías de hoy</p>
          <p className="text-4xl font-semibold tabular-nums tracking-tight">
            {Math.round(consumed.calories)}
            <span className="text-[var(--color-muted-foreground)] text-lg font-normal">
              {' '}
              / {goal.calorieTarget}
            </span>
          </p>
        </div>
        <p className="text-right text-sm">
          <span
            className={
              calRemaining >= 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-destructive)]'
            }
          >
            {calRemaining >= 0 ? `${Math.round(calRemaining)} restantes` : `${Math.round(-calRemaining)} de más`}
          </span>
        </p>
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-muted)]"
        role="progressbar"
        aria-valuenow={calPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progreso de calorías"
      >
        <div
          className="h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-500 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)]"
          style={{ width: `${calPct}%` }}
        />
      </div>

      <ul className="space-y-3">
        {bars.map((b) => {
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
                  className="h-full rounded-full transition-[width] duration-500 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)]"
                  style={{ width: `${barPct}%`, backgroundColor: b.colorVar }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
