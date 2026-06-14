import type { Metadata } from 'next';

import { EmptyPlanState, PlanView } from '@/features/meal-plan/plan-view';
import { requireUser } from '@/lib/auth/get-user';
import { getActivePlan } from '@/repositories/meal-plans.repo';

export const metadata: Metadata = { title: 'Mi plan' };

export default async function PlanPage() {
  const user = await requireUser();
  const plan = await getActivePlan(user);

  return (
    <main className="space-y-6 p-5">
      <header className="space-y-0.5">
        <p className="text-[var(--color-muted-foreground)] text-sm">Comidas sugeridas</p>
        <h1 className="text-2xl font-bold tracking-tight">Mi plan</h1>
      </header>

      {plan ? <PlanView plan={plan} /> : <EmptyPlanState />}
    </main>
  );
}
