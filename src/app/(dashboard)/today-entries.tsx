'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { deleteEntryAction, restoreEntryAction } from '@/features/logging/actions';
import type { MealType } from '@/lib/validation/meal';
import type { DayEntry } from '@/repositories/meal-logs.repo';


const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  dinner: 'Cena',
  snack: 'Snack',
};

function timeLabel(d: Date): string {
  return new Date(d).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

export function TodayEntries({ entries }: { entries: DayEntry[] }) {
  const router = useRouter();
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [, startMutation] = useTransition();

  function hide(id: string) {
    setRemoved((s) => new Set(s).add(id));
  }
  function unhide(id: string) {
    setRemoved((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  }

  function handleDelete(entry: DayEntry) {
    hide(entry.mealItemId); // optimistic
    startMutation(async () => {
      const res = await deleteEntryAction(entry.mealItemId);
      if (!res.ok) {
        unhide(entry.mealItemId);
        toast.error(res.error);
        return;
      }
      toast.success(`${entry.foodName} eliminado`, {
        action: {
          label: 'Deshacer',
          onClick: () => {
            startMutation(async () => {
              const restore = await restoreEntryAction(entry.mealItemId);
              if (restore.ok) {
                unhide(entry.mealItemId);
                router.refresh();
              } else {
                toast.error(restore.error);
              }
            });
          },
        },
      });
      router.refresh();
    });
  }

  const visible = entries.filter((e) => !removed.has(e.mealItemId));

  if (visible.length === 0) {
    return (
      <p className="text-[var(--color-muted-foreground)] px-5 py-6 text-center text-sm">
        Aún no has registrado nada hoy.
      </p>
    );
  }

  return (
    <div className="divide-y divide-[var(--color-border)]">
      {visible.map((e) => (
        <div key={e.mealItemId} className="flex items-center justify-between gap-3 px-5 py-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{e.foodName}</p>
            <p className="text-[var(--color-muted-foreground)] text-xs">
              {MEAL_LABEL[e.mealType]} · {Math.round(e.quantityGrams)} g · {timeLabel(e.loggedAt)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span className="text-sm font-semibold tabular-nums">{Math.round(e.calories)} kcal</span>
            <button
              type="button"
              onClick={() => handleDelete(e)}
              aria-label={`Eliminar ${e.foodName}`}
              className="text-[var(--color-muted-foreground)] hover:text-[var(--color-destructive)] -mr-2 ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md transition-[color,transform] duration-150 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] active:scale-[0.9]"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
