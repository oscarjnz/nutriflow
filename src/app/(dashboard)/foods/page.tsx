import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { FoodSelectionEditor } from '@/features/onboarding/food-selection-editor';
import { requireUser } from '@/lib/auth/get-user';
import { getSelectedFoodIds, listSelectableFoods } from '@/repositories/user-food-selections.repo';

export const metadata: Metadata = { title: 'Mis alimentos' };

export default async function FoodsPage() {
  const user = await requireUser();
  const [foods, selectedFoodIds] = await Promise.all([
    listSelectableFoods(),
    getSelectedFoodIds(user),
  ]);

  return (
    <main className="space-y-5 p-5">
      <header className="space-y-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/profile">
            <ArrowLeft className="h-4 w-4" />
            Perfil
          </Link>
        </Button>
        <div className="space-y-0.5">
          <h1 className="text-2xl font-bold tracking-tight">Mis alimentos</h1>
          <p className="text-[var(--color-muted-foreground)] text-sm">
            Ajusta lo que tienes a mano. Al guardar, regeneramos tu plan.
          </p>
        </div>
      </header>

      <FoodSelectionEditor foods={foods} initialSelectedIds={selectedFoodIds} />
    </main>
  );
}
