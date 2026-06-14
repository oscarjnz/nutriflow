'use client';

import { Barcode, Check, Loader2, Minus, Plus, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  importAndLogMealAction,
  logMealAction,
  lookupBarcodeAction,
  searchFoodsAction,
} from '@/features/logging/actions';
import type { MealType } from '@/lib/validation/meal';
import type { FoodSearchResult } from '@/repositories/foods.repo';


const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Desayuno' },
  { value: 'lunch', label: 'Almuerzo' },
  { value: 'dinner', label: 'Cena' },
  { value: 'snack', label: 'Snack' },
];

function defaultMealType(): MealType {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

export function LogClient() {
  const router = useRouter();
  const [mealType, setMealType] = useState<MealType>(defaultMealType);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [selected, setSelected] = useState<FoodSearchResult | null>(null);
  const [grams, setGrams] = useState(100);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [searching, startSearch] = useTransition();
  const [logging, startLog] = useTransition();
  const [lookingUp, startLookup] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback((q: string) => {
    startSearch(async () => {
      const res = await searchFoodsAction(q);
      if (res.ok) setResults(res.foods);
      else toast.error(res.error);
    });
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length === 0) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(q), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  function pick(food: FoodSearchResult) {
    setSelected(food);
    setGrams(food.defaultServingGrams ?? 100);
  }

  function resetAfterLog() {
    setSelected(null);
    setQuery('');
    setResults([]);
    setBarcode('');
    setBarcodeOpen(false);
  }

  function handleLog() {
    if (!selected) return;
    startLog(async () => {
      // Local foods log by id; un-imported OFF hits import-then-log by barcode.
      const res =
        selected.origin === 'off' && selected.barcode
          ? await importAndLogMealAction({ barcode: selected.barcode, grams, mealType })
          : await logMealAction({ foodId: selected.id, grams, mealType });
      if (res.ok) {
        toast.success(`${selected.nameEs} agregado`);
        resetAfterLog();
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleBarcodeLookup() {
    const code = barcode.trim();
    if (code.length === 0) return;
    startLookup(async () => {
      const res = await lookupBarcodeAction(code);
      if (res.ok) {
        setQuery('');
        setResults([res.food]);
        pick(res.food);
      } else {
        toast.error(res.error);
      }
    });
  }

  const previewKcal = selected ? Math.round((selected.caloriesPer100g * grams) / 100) : 0;

  return (
    <main className="space-y-5 p-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Registrar</h1>
        <p className="text-[var(--color-muted-foreground)] text-sm">
          Busca un alimento y agrégalo en segundos.
        </p>
      </header>

      <div className="flex gap-2" role="tablist" aria-label="Tipo de comida">
        {MEAL_TYPES.map((m) => {
          const active = m.value === mealType;
          return (
            <button
              key={m.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMealType(m.value)}
              className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-[background-color,border-color,transform] duration-150 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] ${
                active
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                  : 'border-[var(--color-border)] bg-[var(--color-background)]'
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="relative">
        <Search className="text-[var(--color-muted-foreground)] pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Arroz, pollo, aguacate…"
          aria-label="Buscar alimento"
          className="h-11 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-background)] pl-9 pr-9 text-base placeholder:text-[var(--color-muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]"
        />
        {searching && (
          <Loader2 className="text-[var(--color-muted-foreground)] absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin" />
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setBarcodeOpen((o) => !o)}
          aria-expanded={barcodeOpen}
          className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
        >
          <Barcode className="h-3.5 w-3.5" />
          {barcodeOpen ? 'Buscar por nombre' : '¿Tienes el código de barras?'}
        </button>

        {barcodeOpen && (
          <div className="mt-2 flex gap-2">
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value.replace(/[^\d\s]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && handleBarcodeLookup()}
              inputMode="numeric"
              placeholder="Ej. 8410376012705"
              aria-label="Código de barras"
              className="h-11 flex-1 rounded-lg border border-[var(--color-input)] bg-[var(--color-background)] px-3 text-base tabular-nums placeholder:text-[var(--color-muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]"
            />
            <Button
              type="button"
              variant="outline"
              disabled={lookingUp || barcode.trim().length < 8}
              onClick={handleBarcodeLookup}
            >
              {lookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
            </Button>
          </div>
        )}
      </div>

      <ul className="space-y-2">
        {results.map((food, i) => {
          const isOpen = selected?.id === food.id;
          return (
            <li
              key={food.id}
              className="overflow-hidden rounded-xl border border-[var(--color-border)]"
              style={{
                animation: 'log-in 240ms cubic-bezier(0.23,1,0.32,1) both',
                animationDelay: `${Math.min(i, 8) * 30}ms`,
              }}
            >
              <button
                type="button"
                onClick={() => (isOpen ? setSelected(null) : pick(food))}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-muted)]"
                aria-expanded={isOpen}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium">{food.nameEs}</span>
                    {food.origin === 'off' && (
                      <span className="text-[var(--color-muted-foreground)] shrink-0 rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                        OFF
                      </span>
                    )}
                  </span>
                  <span className="text-[var(--color-muted-foreground)] text-xs">
                    {Math.round(food.caloriesPer100g)} kcal / 100 g
                  </span>
                </span>
                {!isOpen && <Plus className="text-[var(--color-muted-foreground)] h-4 w-4 shrink-0" />}
              </button>

              {isOpen && (
                <div className="border-t border-[var(--color-border)] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Quitar 10 gramos"
                        onClick={() => setGrams((g) => Math.max(1, g - 10))}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <div className="w-20 text-center">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={grams}
                          min={1}
                          onChange={(e) =>
                            setGrams(Math.max(1, Math.min(100_000, Number(e.target.value) || 1)))
                          }
                          aria-label="Gramos"
                          className="w-full bg-transparent text-center text-lg font-semibold tabular-nums focus-visible:outline-none"
                        />
                        <span className="text-[var(--color-muted-foreground)] text-xs">gramos</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Agregar 10 gramos"
                        onClick={() => setGrams((g) => Math.min(100_000, g + 10))}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <span className="text-right text-sm font-semibold tabular-nums">
                      {previewKcal} kcal
                    </span>
                  </div>

                  <Button
                    type="button"
                    className="mt-4 w-full"
                    disabled={logging}
                    onClick={handleLog}
                  >
                    {logging ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Agregando…
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Agregar
                      </>
                    )}
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {query.trim().length > 0 && !searching && results.length === 0 && (
        <p className="text-[var(--color-muted-foreground)] py-6 text-center text-sm">
          Sin resultados para «{query.trim()}».
        </p>
      )}

      <style>{`@keyframes log-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </main>
  );
}
