import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PlanRecord } from '@/components/shared/plan-record';
import { PrintButton } from '@/components/shared/print-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { requireUser } from '@/lib/auth/get-user';
import { getActivePlan } from '@/repositories/meal-plans.repo';
import { getProfile } from '@/repositories/user-profile.repo';

export const metadata: Metadata = { title: 'Mi record' };

export default async function RecordPage() {
  const user = await requireUser();
  const [plan, profile] = await Promise.all([getActivePlan(user), getProfile(user.id)]);
  const recordName = profile?.recordName ?? user.displayName ?? 'Mi plan';

  return (
    <main className="space-y-5 p-5">
      <header className="flex items-center justify-between print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href="/profile">
            <ArrowLeft className="h-4 w-4" />
            Perfil
          </Link>
        </Button>
      </header>

      {plan ? (
        <>
          <PlanRecord plan={plan} recordName={recordName} />
          <PrintButton />
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-[var(--color-muted-foreground)] text-sm">
              Aún no tienes un plan generado.
            </p>
            <Button asChild>
              <Link href="/plan">Ver mi plan</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
