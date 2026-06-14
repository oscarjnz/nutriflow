'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { saveGoalAction } from '@/features/goals/actions';
import { atwaterCalories } from '@/lib/nutrition/macros';
import type { MacroGoal } from '@/repositories/user-goals.repo';


const FIELDS = [
  { key: 'calorieTarget', label: 'Calorías', unit: 'kcal' },
  { key: 'proteinTarget', label: 'Proteína', unit: 'g' },
  { key: 'carbsTarget', label: 'Carbohidratos', unit: 'g' },
  { key: 'fatTarget', label: 'Grasa', unit: 'g' },
] as const;

export function GoalsForm({ initial }: { initial: MacroGoal }) {
  const router = useRouter();
  const [values, setValues] = useState<MacroGoal>(initial);
  const [saving, startSave] = useTransition();

  const macroKcal = atwaterCalories(values.proteinTarget, values.carbsTarget, values.fatTarget);
  const drift = Math.round(macroKcal - values.calorieTarget);

  function update(key: keyof MacroGoal, raw: string) {
    const n = Math.max(0, Math.round(Number(raw) || 0));
    setValues((v) => ({ ...v, [key]: n }));
  }

  function handleSave() {
    startSave(async () => {
      const res = await saveGoalAction(values);
      if (res.ok) {
        toast.success('Metas actualizadas');
        router.push('/');
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        {FIELDS.map((f) => (
          <div key={f.key} className="flex items-center justify-between gap-4">
            <label htmlFor={f.key} className="text-sm font-medium">
              {f.label}
            </label>
            <div className="flex items-baseline gap-2">
              <input
                id={f.key}
                type="number"
                inputMode="numeric"
                min={0}
                value={values[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
                className="h-10 w-24 rounded-lg border border-[var(--color-input)] bg-[var(--color-background)] px-3 text-right text-base tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]"
              />
              <span className="text-[var(--color-muted-foreground)] w-8 text-xs">{f.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[var(--color-muted-foreground)] text-xs">
        Tus macros suman <span className="font-medium tabular-nums">{macroKcal} kcal</span>
        {drift !== 0 && (
          <>
            {' '}
            ({drift > 0 ? '+' : ''}
            {drift} vs tu meta de calorías)
          </>
        )}
        .
      </p>

      <Button className="w-full" disabled={saving} onClick={handleSave}>
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Guardando…
          </>
        ) : (
          'Guardar metas'
        )}
      </Button>
    </div>
  );
}
