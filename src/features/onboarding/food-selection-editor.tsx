'use client';

import { Check, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { updateFoodSelectionsAction } from '@/features/onboarding/actions';
import {
  CATEGORY_META,
  type SelectableFood,
  selectionMeetsMinimums,
} from '@/features/onboarding/food-selection';

/**
 * Standalone editor for the user's available foods, used from the profile.
 * Same category + minimum rules as the onboarding step; saving regenerates the
 * active plan so it reflects the new selection.
 */
export function FoodSelectionEditor({
  foods,
  initialSelectedIds,
}: {
  foods: SelectableFood[];
  initialSelectedIds: string[];
}) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set(initialSelectedIds));

  const meetsMinimums = useMemo(() => selectionMeetsMinimums(selected, foods), [selected, foods]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    if (!meetsMinimums) {
      toast.error('Elige los mínimos de cada categoría.');
      return;
    }
    startSave(async () => {
      const res = await updateFoodSelectionsAction([...selected]);
      if (res.ok) {
        toast.success('Alimentos actualizados y plan regenerado');
        router.push('/plan');
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        {CATEGORY_META.map((cat) => {
          const items = foods.filter((f) => f.category === cat.value);
          if (items.length === 0) return null;
          const count = items.filter((f) => selected.has(f.id)).length;
          const met = count >= cat.min;

          return (
            <section key={cat.value} className="space-y-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium">{cat.label}</p>
                <span
                  className={`text-xs tabular-nums ${
                    met
                      ? 'text-[var(--color-muted-foreground)]'
                      : 'text-[var(--color-primary)] font-medium'
                  }`}
                >
                  {cat.min > 0 ? `${count}/${cat.min}` : cat.hint}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {items.map((f) => {
                  const active = selected.has(f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggle(f.id)}
                      className={`rounded-full border px-3.5 py-2 text-sm transition-[border-color,background-color,transform] duration-150 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] active:scale-[0.96] ${
                        active
                          ? 'border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] font-medium'
                          : 'border-[var(--color-border)] hover:bg-[var(--color-muted)]'
                      }`}
                    >
                      {f.nameEs}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="sticky bottom-20 bg-[var(--color-background)] pt-2">
        <Button className="w-full" disabled={saving || !meetsMinimums} onClick={save}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Guardando y regenerando…
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Guardar y regenerar plan
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
