import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { requireUser } from '@/lib/auth/get-user';
import { getActiveGoal } from '@/repositories/user-goals.repo';

import { GoalsForm } from './goals-form';

export const metadata: Metadata = { title: 'Metas' };

export default async function GoalsPage() {
  const user = await requireUser();
  const goal = await getActiveGoal(user);

  return (
    <main className="space-y-5 p-5">
      <header className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-bold tracking-tight">Mis metas</h1>
          <p className="text-[var(--color-muted-foreground)] text-sm">
            Objetivos diarios de calorías y macros.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/">Volver</Link>
        </Button>
      </header>

      <Card>
        <CardContent className="pt-5">
          <GoalsForm initial={goal} />
        </CardContent>
      </Card>
    </main>
  );
}
