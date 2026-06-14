import Link from 'next/link';

import { MacroBars } from '@/components/shared/macro-bars';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { requireUser } from '@/lib/auth/get-user';
import { dayRange } from '@/lib/datetime/day';
import { getDayEntries, getDayMacroTotals } from '@/repositories/meal-logs.repo';
import { getActiveGoal } from '@/repositories/user-goals.repo';

import { TodayEntries } from './today-entries';

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
          <p className="text-[var(--color-muted-foreground)] text-sm">
            Hola{user.displayName ? `, ${user.displayName}` : ''}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Resumen de hoy</h1>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/goals">Metas</Link>
        </Button>
      </header>

      <Card className="shadow-[var(--shadow-float)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-primary)_5%,var(--color-card)),var(--color-card)_55%)]">
        <CardContent className="pt-6">
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
            <CardContent className="p-0">
              <TodayEntries entries={entries} />
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  );
}
