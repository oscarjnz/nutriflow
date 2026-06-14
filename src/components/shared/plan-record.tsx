import { BRAND_NAME, LogoMark } from '@/components/shared/logo';
import { MEAL_TYPE_LABEL } from '@/features/meal-plan/labels';
import type { ActivePlan } from '@/repositories/meal-plans.repo';

/**
 * Print-friendly, hook-free rendering of a saved meal plan: the brand mark, the
 * record name, the daily targets, and every meal with its foods + portions.
 * Used by the exportable record page (which adds print styles + a print button).
 */

const MACROS = [
  { key: 'protein', label: 'Proteína', color: 'var(--color-macro-protein)' },
  { key: 'carbs', label: 'Carbos', color: 'var(--color-macro-carbs)' },
  { key: 'fat', label: 'Grasa', color: 'var(--color-macro-fat)' },
] as const;

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

export function PlanRecord({
  plan,
  recordName,
}: {
  plan: ActivePlan;
  recordName: string;
}) {
  const targets = { protein: plan.proteinTarget, carbs: plan.carbsTarget, fat: plan.fatTarget };

  return (
    <article className="space-y-6">
      <header className="flex items-center gap-3 border-b border-[var(--color-border)] pb-4">
        <LogoMark className="h-10 w-10" />
        <div className="min-w-0">
          <p className="text-[var(--color-muted-foreground)] text-xs uppercase tracking-wide">
            Plan {BRAND_NAME}
          </p>
          <h2 className="truncate text-xl font-bold tracking-tight">{recordName}</h2>
          <p className="text-[var(--color-muted-foreground)] text-xs">
            Generado el {fmtDate(plan.createdAt)}
          </p>
        </div>
      </header>

      <section className="space-y-3">
        <div className="text-center">
          <p className="text-[var(--color-muted-foreground)] text-sm">Objetivo diario</p>
          <p className="text-4xl font-semibold tracking-tight tabular-nums">
            {plan.calorieTarget}
            <span className="text-[var(--color-muted-foreground)] ml-1 text-lg font-normal">kcal</span>
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {MACROS.map((m) => (
            <div key={m.key} className="rounded-xl border border-[var(--color-border)] p-3 text-center">
              <span
                className="mx-auto mb-1.5 block h-1.5 w-8 rounded-full"
                style={{ backgroundColor: m.color }}
              />
              <p className="text-base font-semibold tabular-nums">{targets[m.key]} g</p>
              <p className="text-[var(--color-muted-foreground)] text-xs">{m.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        {plan.meals.map((meal) => (
          <div
            key={meal.slot}
            className="break-inside-avoid rounded-xl border border-[var(--color-border)] p-4"
          >
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h3 className="font-semibold">{MEAL_TYPE_LABEL[meal.mealType]}</h3>
              <span className="text-[var(--color-muted-foreground)] text-xs tabular-nums">
                {Math.round(meal.totals.calories)} kcal
              </span>
            </div>
            <ul className="space-y-1.5">
              {meal.items.map((item) => (
                <li key={item.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{item.foodName}</span>
                  <span className="text-[var(--color-muted-foreground)] shrink-0 tabular-nums">
                    {Math.round(item.grams)} g · {Math.round(item.calories)} kcal
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </article>
  );
}
