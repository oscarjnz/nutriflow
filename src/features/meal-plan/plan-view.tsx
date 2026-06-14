'use client';

import { Check, Loader2, Plus, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ActivePlan } from '@/repositories/meal-plans.repo';

import { logPlannedMealAction, regeneratePlanAction } from './actions';
import { MEAL_TYPE_LABEL } from './labels';

export function PlanView({ plan }: { plan: ActivePlan }) {
  const router = useRouter();
  const [regenerating, startRegen] = useTransition();
  const [loggingSlot, setLoggingSlot] = useState<number | null>(null);
  const [loggedSlots, setLoggedSlots] = useState<ReadonlySet<number>>(new Set());

  function regenerate() {
    startRegen(async () => {
      const res = await regeneratePlanAction();
      if (res.ok) {
        setLoggedSlots(new Set());
        toast.success('Plan regenerado');
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function logMeal(slot: number) {
    setLoggingSlot(slot);
    void (async () => {
      const res = await logPlannedMealAction(slot);
      setLoggingSlot(null);
      if (res.ok) {
        setLoggedSlots((prev) => new Set(prev).add(slot));
        toast.success('Comida registrada');
        router.refresh();
      } else {
        toast.error(res.error);
      }
    })();
  }

  return (
    <div className="space-y-5">
      <Card className="shadow-[var(--shadow-float)]">
        <CardContent className="space-y-3 pt-6">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-[var(--color-muted-foreground)] text-sm">Objetivo diario</p>
              <p className="text-3xl font-semibold tracking-tight tabular-nums">
                {plan.calorieTarget}
                <span className="text-[var(--color-muted-foreground)] ml-1 text-base font-normal">
                  kcal
                </span>
              </p>
            </div>
            <p className="text-[var(--color-muted-foreground)] text-xs tabular-nums">
              Plan: {Math.round(plan.totals.calories)} kcal
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <Macro label="Proteína" grams={plan.proteinTarget} color="var(--color-macro-protein)" />
            <Macro label="Carbos" grams={plan.carbsTarget} color="var(--color-macro-carbs)" />
            <Macro label="Grasa" grams={plan.fatTarget} color="var(--color-macro-fat)" />
          </div>
        </CardContent>
      </Card>

      <Button
        variant="outline"
        className="w-full"
        disabled={regenerating}
        onClick={regenerate}
      >
        {regenerating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generando…
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4" />
            Regenerar plan
          </>
        )}
      </Button>

      <div className="space-y-3">
        {plan.meals.map((meal) => {
          const logged = loggedSlots.has(meal.slot);
          return (
            <Card key={meal.slot}>
              <CardContent className="space-y-3 pt-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-semibold">{MEAL_TYPE_LABEL[meal.mealType]}</h2>
                  <span className="text-[var(--color-muted-foreground)] text-xs tabular-nums">
                    {Math.round(meal.totals.calories)} kcal · {Math.round(meal.totals.protein)} g P
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
                <Button
                  className="w-full"
                  variant={logged ? 'outline' : 'default'}
                  disabled={loggingSlot === meal.slot || logged}
                  onClick={() => logMeal(meal.slot)}
                >
                  {loggingSlot === meal.slot ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Registrando…
                    </>
                  ) : logged ? (
                    <>
                      <Check className="h-4 w-4" />
                      Registrada
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Registrar esta comida
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function EmptyPlanState() {
  const router = useRouter();
  const [generating, startGen] = useTransition();

  function generate() {
    startGen(async () => {
      const res = await regeneratePlanAction();
      if (res.ok) {
        toast.success('Plan generado');
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-[var(--color-muted-foreground)] text-sm">
          Aún no tienes un plan generado.
        </p>
        <Button disabled={generating} onClick={generate}>
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generando…
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Generar mi plan
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function Macro({ label, grams, color }: { label: string; grams: number; color: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] p-2">
      <span className="mx-auto mb-1 block h-1.5 w-7 rounded-full" style={{ backgroundColor: color }} />
      <p className="font-semibold tabular-nums">{grams} g</p>
      <p className="text-[var(--color-muted-foreground)] text-xs">{label}</p>
    </div>
  );
}
