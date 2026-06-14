import Link from 'next/link';

import { MacroBars } from '@/components/shared/macro-bars';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireUser } from '@/lib/auth/get-user';
import { dayRange } from '@/lib/datetime/day';
import type { MealType } from '@/lib/validation/meal';
import { getDayEntries, getDayMacroTotals } from '@/repositories/meal-logs.repo';
import { getActiveGoal } from '@/repositories/user-goals.repo';

const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  dinner: 'Cena',
  snack: 'Snack',
};

function timeLabel(d: Date): string {
  return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

export default async function DashboardHomePage() {
  const user = await requireUser();
  const { start, end } = dayRange();

  const [goal, totals, entries] = await Promise.all([
    getActiveGoal(user),
    getDayMacroTotals(user, start, end),
    getDayEntries(user, start, end),
  ]);

  return (
    <main className="space-y-6 p-5">
      <header className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-[var(--color-muted-foreground)] text-sm">Hola{user.displayName ? `, ${user.displayName}` : ''}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Resumen de hoy</h1>
        </div>
      </header>

      <Card>
        <CardContent className="pt-5">
          <MacroBars consumed={totals} goal={goal} />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Comidas de hoy</h2>
          <Button asChild size="sm" variant="outline">
            <Link href="/log">Registrar</Link>
          </Button>
        </div>

        {entries.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-[var(--color-muted-foreground)] text-sm">
                Aún no has registrado nada hoy.
              </p>
              <Button asChild>
                <Link href="/log">Registrar primera comida</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="sr-only">
              <CardTitle>Lista de comidas</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-[var(--color-border)] p-0">
              {entries.map((e) => (
                <div key={e.mealItemId} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.foodName}</p>
                    <p className="text-[var(--color-muted-foreground)] text-xs">
                      {MEAL_LABEL[e.mealType]} · {Math.round(e.quantityGrams)} g · {timeLabel(e.loggedAt)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {Math.round(e.calories)} kcal
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  );
}
