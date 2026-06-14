'use client';

import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Logo } from '@/components/shared/logo';
import { PlanSummary } from '@/components/shared/plan-summary';
import { Button } from '@/components/ui/button';
import { completeOnboardingAction } from '@/features/onboarding/actions';
import {
  CATEGORY_META,
  type SelectableFood,
  selectionMeetsMinimums,
} from '@/features/onboarding/food-selection';
import {
  ACTIVITY_OPTIONS,
  DIET_OPTIONS,
  FASTING_OPTIONS,
  GOAL_OPTIONS,
  METHOD_OPTIONS,
  type Option,
  PACE_OPTIONS,
  SEX_OPTIONS,
  SUGGESTION_OPTIONS,
} from '@/features/onboarding/options';
import { type BodyInput, bodyMassIndex, computeBodyPlan } from '@/lib/nutrition/body';
import type { OnboardingInput } from '@/lib/validation/onboarding';

type Answers = Omit<OnboardingInput, 'age' | 'heightCm' | 'weightKg' | 'targetWeightKg'> & {
  age: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
};

export interface OnboardingDefaults {
  recordName: string;
  selectableFoods: SelectableFood[];
  selectedFoodIds: string[];
  answers: Partial<Answers>;
}

const LB_PER_KG = 2.2046226218;
const IN_PER_CM = 0.3937007874;

function kgToLb(kg: number): number {
  return Math.round(kg * LB_PER_KG);
}
function lbToKg(lb: number): number {
  return Math.round((lb / LB_PER_KG) * 10) / 10;
}
function cmToFtIn(cm: number): { ft: number; inch: number } {
  const totalIn = cm * IN_PER_CM;
  const ft = Math.floor(totalIn / 12);
  return { ft, inch: Math.round(totalIn - ft * 12) };
}
function ftInToCm(ft: number, inch: number): number {
  return Math.round((ft * 12 + inch) / IN_PER_CM);
}

export function OnboardingClient({ defaults }: { defaults: OnboardingDefaults }) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [step, setStep] = useState(0);

  const [a, setA] = useState<Answers>({
    recordName: defaults.recordName,
    goal: defaults.answers.goal ?? 'lose_fat',
    method: defaults.answers.method ?? 'meal_plan',
    sex: defaults.answers.sex ?? 'male',
    age: defaults.answers.age ?? 30,
    heightCm: defaults.answers.heightCm ?? 170,
    weightKg: defaults.answers.weightKg ?? 75,
    targetWeightKg: defaults.answers.targetWeightKg ?? 70,
    pace: defaults.answers.pace ?? 'recommended',
    activityLevel: defaults.answers.activityLevel ?? 'light',
    trainingDays: defaults.answers.trainingDays ?? 3,
    strengthTraining: defaults.answers.strengthTraining ?? false,
    diet: defaults.answers.diet ?? 'recommended',
    measurementUnits: defaults.answers.measurementUnits ?? 'metric',
    mealsPerDay: defaults.answers.mealsPerDay ?? 3,
    mainMeals: defaults.answers.mainMeals ?? 3,
    suggestionStyle: defaults.answers.suggestionStyle ?? 'mixed',
    foodSelections: defaults.selectedFoodIds,
    intermittentFasting: defaults.answers.intermittentFasting ?? 'never',
  });

  function set<K extends keyof Answers>(key: K, value: Answers[K]) {
    setA((prev) => ({ ...prev, [key]: value }));
  }

  const bodyInput: BodyInput = {
    sex: a.sex,
    age: a.age,
    heightCm: a.heightCm,
    weightKg: a.weightKg,
    targetWeightKg: a.targetWeightKg,
    goal: a.goal,
    pace: a.pace,
    activityLevel: a.activityLevel,
    trainingDays: a.trainingDays,
    strengthTraining: a.strengthTraining,
    diet: a.diet,
  };

  const plan = useMemo(() => {
    try {
      return computeBodyPlan(bodyInput);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    a.sex,
    a.age,
    a.heightCm,
    a.weightKg,
    a.targetWeightKg,
    a.goal,
    a.pace,
    a.activityLevel,
    a.trainingDays,
    a.strengthTraining,
    a.diet,
  ]);

  const steps = buildSteps(a, set, defaults);
  const current = steps[step];
  const isResults = step === steps.length;
  const total = steps.length + 1;

  function next() {
    if (current && !current.valid) {
      toast.error('Completa este paso para continuar.');
      return;
    }
    setStep((s) => Math.min(s + 1, steps.length));
  }
  function back() {
    setStep((s) => Math.max(0, s - 1));
  }

  function finish() {
    startSave(async () => {
      const payload: OnboardingInput = {
        recordName: a.recordName.trim(),
        goal: a.goal,
        method: a.method,
        sex: a.sex,
        age: a.age,
        heightCm: a.heightCm,
        weightKg: a.weightKg,
        targetWeightKg: a.targetWeightKg,
        pace: a.pace,
        activityLevel: a.activityLevel,
        trainingDays: a.trainingDays,
        strengthTraining: a.strengthTraining,
        diet: a.diet,
        measurementUnits: a.measurementUnits,
        mealsPerDay: a.mealsPerDay,
        mainMeals: a.mainMeals,
        suggestionStyle: a.suggestionStyle,
        foodSelections: a.foodSelections,
        intermittentFasting: a.intermittentFasting,
      };
      const res = await completeOnboardingAction(payload);
      if (res.ok) {
        toast.success('Tu plan está listo');
        router.push('/');
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const progress = Math.round(((step + (isResults ? 1 : 0)) / total) * 100);

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col p-5">
      <header className="space-y-4 pb-2">
        <div className="flex items-center justify-between">
          <Logo markClassName="h-7 w-7" />
          {step > 0 && !saving && (
            <button
              type="button"
              onClick={back}
              className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] inline-flex items-center gap-1 text-sm transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Atrás
            </button>
          )}
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-muted)]"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-500 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <div key={saving ? 'saving' : step} className="flex-1 py-6 [animation:onb-in_260ms_cubic-bezier(0.23,1,0.32,1)_both]">
        {saving ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
            <Loader2 className="text-[var(--color-primary)] h-9 w-9 animate-spin" />
            <div className="space-y-1">
              <p className="text-lg font-semibold tracking-tight">
                Buscando las mejores comidas para ti
              </p>
              <p className="text-[var(--color-muted-foreground)] text-sm">
                Armamos tu plan con los alimentos que elegiste.
              </p>
            </div>
          </div>
        ) : isResults ? (
          <div className="space-y-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">Tu plan, {a.recordName}</h1>
              <p className="text-[var(--color-muted-foreground)] text-sm">
                Calculado con tus datos. Podrás ajustarlo cuando quieras.
              </p>
            </div>
            {plan ? (
              <PlanSummary plan={plan} />
            ) : (
              <p className="text-[var(--color-destructive)] text-sm">
                Revisa tus datos: algún valor está fuera de rango.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">{current?.title}</h1>
              {current?.subtitle && (
                <p className="text-[var(--color-muted-foreground)] text-sm">{current.subtitle}</p>
              )}
            </div>
            {current?.body}
          </div>
        )}
      </div>

      {!saving && (
        <footer className="sticky bottom-0 bg-[var(--color-background)] pb-[env(safe-area-inset-bottom)] pt-3">
          {isResults ? (
            <Button className="w-full" disabled={!plan} onClick={finish}>
              <Check className="h-4 w-4" />
              Confirmar y empezar
            </Button>
          ) : (
            <Button className="w-full" onClick={next}>
              Continuar
            </Button>
          )}
        </footer>
      )}

      <style>{`@keyframes onb-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </main>
  );
}

// ── Step definitions ─────────────────────────────────────────────────────────

interface Step {
  title: string;
  subtitle?: string;
  body: React.ReactNode;
  valid: boolean;
}

function buildSteps(
  a: Answers,
  set: <K extends keyof Answers>(key: K, value: Answers[K]) => void,
  defaults: OnboardingDefaults,
): Step[] {
  const healthy = bodyMassIndex(a.weightKg, a.heightCm);

  return [
    {
      title: '¿Cuál es tu objetivo?',
      subtitle: 'Define cómo calculamos todo lo demás.',
      valid: true,
      body: <Cards options={GOAL_OPTIONS} value={a.goal} onChange={(v) => set('goal', v)} />,
    },
    {
      title: '¿Cómo quieres lograrlo?',
      valid: true,
      body: <Cards options={METHOD_OPTIONS} value={a.method} onChange={(v) => set('method', v)} />,
    },
    {
      title: 'Sobre ti',
      subtitle: 'Necesitamos esto para tu metabolismo.',
      valid: a.age >= 14 && a.age <= 100 && a.heightCm >= 100 && a.heightCm <= 250 && a.weightKg >= 30 && a.weightKg <= 350,
      body: <PersonalStep a={a} set={set} />,
    },
    {
      title: 'Tu estilo de vida',
      subtitle: 'Tu movimiento diario, sin contar entrenamientos.',
      valid: true,
      body: (
        <Cards
          options={ACTIVITY_OPTIONS}
          value={a.activityLevel}
          onChange={(v) => set('activityLevel', v)}
        />
      ),
    },
    {
      title: 'Entrenamiento',
      subtitle: 'Cuántas veces entrenas por semana.',
      valid: true,
      body: <TrainingStep a={a} set={set} />,
    },
    {
      title: '¿Qué dieta prefieres?',
      valid: true,
      body: <Cards options={DIET_OPTIONS} value={a.diet} onChange={(v) => set('diet', v)} />,
    },
    {
      title: 'Tu peso objetivo',
      subtitle: `Tu rango saludable es ${healthy.healthyMinKg} a ${healthy.healthyMaxKg} kg.`,
      valid: a.targetWeightKg >= 30 && a.targetWeightKg <= 350,
      body: <TargetStep a={a} set={set} />,
    },
    {
      title: '¿Has probado el ayuno intermitente?',
      valid: true,
      body: (
        <Cards
          options={FASTING_OPTIONS}
          value={a.intermittentFasting ?? 'never'}
          onChange={(v) => set('intermittentFasting', v)}
        />
      ),
    },
    {
      title: 'Tu plan diario',
      subtitle: 'Cómo organizamos tus comidas.',
      valid: true,
      body: <PlanStructureStep a={a} set={set} />,
    },
    {
      title: '¿Qué alimentos tienes a mano?',
      subtitle: 'Con esto armaremos tus comidas. Marca lo que sueles tener.',
      valid: selectionMeetsMinimums(new Set(a.foodSelections), defaults.selectableFoods),
      body: <FoodSelectionStep a={a} set={set} foods={defaults.selectableFoods} />,
    },
    {
      title: '¿Cómo quieres que te llamemos?',
      subtitle: 'Este nombre aparecerá en tu record exportable.',
      valid: a.recordName.trim().length > 0,
      body: <NameStep a={a} set={set} placeholder={defaults.recordName} />,
    },
  ];
}

// ── Reusable inputs ──────────────────────────────────────────────────────────

function Cards<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-2.5" role="radiogroup">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left transition-[border-color,background-color,transform] duration-150 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] active:scale-[0.985] ${
              active
                ? 'border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)]'
                : 'border-[var(--color-border)] hover:bg-[var(--color-muted)]'
            }`}
          >
            <span className="min-w-0">
              <span className="block font-medium">{opt.label}</span>
              <span className="text-[var(--color-muted-foreground)] text-sm">{opt.description}</span>
            </span>
            <span
              aria-hidden
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                active ? 'border-[var(--color-primary)]' : 'border-[var(--color-border)]'
              }`}
            >
              {active && <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-primary)]" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function UnitToggle({ a, set }: StepProps) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--color-border)] p-0.5 text-sm">
      {(['metric', 'imperial'] as const).map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => set('measurementUnits', u)}
          className={`rounded-md px-3 py-1 font-medium transition-colors ${
            a.measurementUnits === u
              ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
              : 'text-[var(--color-muted-foreground)]'
          }`}
        >
          {u === 'metric' ? 'cm / kg' : 'ft / lb'}
        </button>
      ))}
    </div>
  );
}

interface StepProps {
  a: Answers;
  set: <K extends keyof Answers>(key: K, value: Answers[K]) => void;
}

function NumberField({
  label,
  value,
  onChange,
  unit,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  unit: string;
  min: number;
  max: number;
}) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium">{label}</span>
      <span className="flex items-baseline gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
          className="h-11 w-24 rounded-lg border border-[var(--color-input)] bg-[var(--color-background)] px-3 text-right text-base tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]"
        />
        <span className="text-[var(--color-muted-foreground)] w-8 text-sm">{unit}</span>
      </span>
    </label>
  );
}

function PersonalStep({ a, set }: StepProps) {
  const imperial = a.measurementUnits === 'imperial';
  const { ft, inch } = cmToFtIn(a.heightCm);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Sexo</span>
        <div className="flex flex-1 gap-2">
          {SEX_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => set('sex', opt.value)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-[border-color,background-color,transform] duration-150 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] ${
                a.sex === opt.value
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                  : 'border-[var(--color-border)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <UnitToggle a={a} set={set} />
      </div>

      <NumberField label="Edad" value={a.age} onChange={(n) => set('age', n)} unit="años" min={14} max={100} />

      {imperial ? (
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium">Altura</span>
          <span className="flex items-baseline gap-2">
            <input
              type="number"
              inputMode="numeric"
              value={ft}
              min={3}
              max={8}
              onChange={(e) => set('heightCm', ftInToCm(Number(e.target.value) || 0, inch))}
              aria-label="Pies"
              className="h-11 w-16 rounded-lg border border-[var(--color-input)] bg-[var(--color-background)] px-3 text-right text-base tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
            />
            <span className="text-[var(--color-muted-foreground)] text-sm">ft</span>
            <input
              type="number"
              inputMode="numeric"
              value={inch}
              min={0}
              max={11}
              onChange={(e) => set('heightCm', ftInToCm(ft, Number(e.target.value) || 0))}
              aria-label="Pulgadas"
              className="h-11 w-16 rounded-lg border border-[var(--color-input)] bg-[var(--color-background)] px-3 text-right text-base tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
            />
            <span className="text-[var(--color-muted-foreground)] text-sm">in</span>
          </span>
        </div>
      ) : (
        <NumberField
          label="Altura"
          value={a.heightCm}
          onChange={(n) => set('heightCm', n)}
          unit="cm"
          min={100}
          max={250}
        />
      )}

      {imperial ? (
        <NumberField
          label="Peso"
          value={kgToLb(a.weightKg)}
          onChange={(n) => set('weightKg', lbToKg(n))}
          unit="lb"
          min={66}
          max={770}
        />
      ) : (
        <NumberField
          label="Peso"
          value={a.weightKg}
          onChange={(n) => set('weightKg', n)}
          unit="kg"
          min={30}
          max={350}
        />
      )}
    </div>
  );
}

function TrainingStep({ a, set }: StepProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-medium">Días de entrenamiento por semana</p>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }, (_, i) => i).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => set('trainingDays', d)}
              aria-label={`${d} días`}
              className={`h-11 w-11 rounded-lg border text-sm font-semibold tabular-nums transition-[border-color,background-color,transform] duration-150 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] active:scale-[0.94] ${
                a.trainingDays === d
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                  : 'border-[var(--color-border)]'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">¿Incluye entrenamiento de fuerza?</p>
        <p className="text-[var(--color-muted-foreground)] text-sm">Nos ayuda a fijar tu proteína.</p>
        <div className="flex gap-2">
          {[
            { v: true, label: 'Sí, levanto pesas' },
            { v: false, label: 'No, sobre todo cardio' },
          ].map((opt) => (
            <button
              key={String(opt.v)}
              type="button"
              onClick={() => set('strengthTraining', opt.v)}
              className={`flex-1 rounded-lg border px-3 py-3 text-sm font-medium transition-[border-color,background-color,transform] duration-150 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] ${
                a.strengthTraining === opt.v
                  ? 'border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)]'
                  : 'border-[var(--color-border)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TargetStep({ a, set }: StepProps) {
  const imperial = a.measurementUnits === 'imperial';
  return (
    <div className="space-y-5">
      {imperial ? (
        <NumberField
          label="Peso objetivo"
          value={kgToLb(a.targetWeightKg)}
          onChange={(n) => set('targetWeightKg', lbToKg(n))}
          unit="lb"
          min={66}
          max={770}
        />
      ) : (
        <NumberField
          label="Peso objetivo"
          value={a.targetWeightKg}
          onChange={(n) => set('targetWeightKg', n)}
          unit="kg"
          min={30}
          max={350}
        />
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium">¿A qué velocidad?</p>
        <Cards options={PACE_OPTIONS} value={a.pace} onChange={(v) => set('pace', v)} />
      </div>
    </div>
  );
}

function PlanStructureStep({ a, set }: StepProps) {
  const mealChoices = [2, 3, 4, 5, 6];
  const maxMain = Math.min(a.mealsPerDay, 4);
  const mainChoices = Array.from({ length: maxMain }, (_, i) => i + 1);

  function setMeals(n: number) {
    set('mealsPerDay', n);
    if (a.mainMeals > n) set('mainMeals', n);
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-medium">¿Cuántas veces comes al día?</p>
        <div className="flex flex-wrap gap-2">
          {mealChoices.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setMeals(n)}
              aria-label={`${n} comidas`}
              className={`h-11 w-11 rounded-lg border text-sm font-semibold tabular-nums transition-[border-color,background-color,transform] duration-150 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] active:scale-[0.94] ${
                a.mealsPerDay === n
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                  : 'border-[var(--color-border)]'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">¿Cuántas son comidas principales?</p>
        <p className="text-[var(--color-muted-foreground)] text-sm">El resto serán snacks.</p>
        <div className="flex flex-wrap gap-2">
          {mainChoices.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => set('mainMeals', n)}
              aria-label={`${n} comidas principales`}
              className={`h-11 w-11 rounded-lg border text-sm font-semibold tabular-nums transition-[border-color,background-color,transform] duration-150 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] active:scale-[0.94] ${
                a.mainMeals === n
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                  : 'border-[var(--color-border)]'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">¿Cómo prefieres las sugerencias?</p>
        <Cards
          options={SUGGESTION_OPTIONS}
          value={a.suggestionStyle}
          onChange={(v) => set('suggestionStyle', v)}
        />
      </div>
    </div>
  );
}

function FoodSelectionStep({
  a,
  set,
  foods,
}: StepProps & { foods: SelectableFood[] }) {
  const selected = new Set(a.foodSelections);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set('foodSelections', [...next]);
  }

  return (
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
  );
}

function NameStep({ a, set, placeholder }: StepProps & { placeholder: string }) {
  return (
    <input
      type="text"
      value={a.recordName}
      maxLength={60}
      autoFocus
      placeholder={placeholder}
      onChange={(e) => set('recordName', e.target.value)}
      aria-label="Tu nombre"
      className="h-12 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-background)] px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]"
    />
  );
}
