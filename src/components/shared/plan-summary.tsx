import type { BodyPlan } from '@/lib/nutrition/body';

/**
 * Read-only visualization of a computed plan: the daily calorie target, the
 * three macro targets in grams, the BMI read, and a small projected-weight
 * roadmap. Pure and hook-free so it renders in both the client wizard and the
 * server-rendered exportable record.
 */

const BMI_LABEL: Record<BodyPlan['bmi']['category'], string> = {
  underweight: 'Bajo peso',
  normal: 'Saludable',
  overweight: 'Sobrepeso',
  obese: 'Obesidad',
};

const MACROS = [
  { key: 'protein', label: 'Proteína', color: 'var(--color-macro-protein)' },
  { key: 'carbs', label: 'Carbos', color: 'var(--color-macro-carbs)' },
  { key: 'fat', label: 'Grasa', color: 'var(--color-macro-fat)' },
] as const;

export function PlanSummary({ plan }: { plan: BodyPlan }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-[var(--color-muted-foreground)] text-sm">Tu objetivo diario</p>
        <p className="text-5xl font-semibold tracking-tight tabular-nums">
          {plan.calorieTarget}
          <span className="text-[var(--color-muted-foreground)] ml-1 text-xl font-normal">kcal</span>
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {MACROS.map((m) => (
          <div
            key={m.key}
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-center shadow-[var(--shadow-soft)]"
          >
            <span
              className="mx-auto mb-1.5 block h-1.5 w-8 rounded-full"
              style={{ backgroundColor: m.color }}
            />
            <p className="text-lg font-semibold tabular-nums">{plan.macros[m.key]} g</p>
            <p className="text-[var(--color-muted-foreground)] text-xs">{m.label}</p>
          </div>
        ))}
      </div>

      <dl className="space-y-1.5 text-sm">
        <Row label="Metabolismo basal (BMR)" value={`${plan.bmr} kcal`} />
        <Row label="Gasto diario (TDEE)" value={`${plan.tdee} kcal`} />
        <Row
          label="Índice de masa corporal"
          value={`${plan.bmi.value} · ${BMI_LABEL[plan.bmi.category]}`}
        />
        <Row
          label="Rango saludable"
          value={`${plan.bmi.healthyMinKg} a ${plan.bmi.healthyMaxKg} kg`}
        />
      </dl>

      {plan.estimatedWeeks !== null && plan.projection.length > 1 && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium">Así será tu progreso</p>
            <p className="text-[var(--color-muted-foreground)] text-xs">
              ~{plan.estimatedWeeks} semanas
            </p>
          </div>
          <ProjectionChart projection={plan.projection} />
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[var(--color-muted-foreground)]">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/** Lightweight inline SVG line chart (no chart dependency on the hot path). */
function ProjectionChart({ projection }: { projection: BodyPlan['projection'] }) {
  const W = 320;
  const H = 96;
  const padX = 10;
  const padY = 14;

  const weeks = projection.map((p) => p.week);
  const weights = projection.map((p) => p.weightKg);
  const minW = Math.min(...weeks);
  const maxW = Math.max(...weeks);
  const minKg = Math.min(...weights);
  const maxKg = Math.max(...weights);
  const spanW = maxW - minW || 1;
  const spanKg = maxKg - minKg || 1;

  const x = (week: number) => padX + ((week - minW) / spanW) * (W - padX * 2);
  const y = (kg: number) => padY + (1 - (kg - minKg) / spanKg) * (H - padY * 2);

  const points = projection.map((p) => `${x(p.week)},${y(p.weightKg)}`).join(' ');
  const first = projection[0];
  const last = projection[projection.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Proyección de peso en el tiempo"
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {first && (
        <>
          <circle cx={x(first.week)} cy={y(first.weightKg)} r={3.5} fill="var(--color-primary)" />
          <text
            x={x(first.week)}
            y={y(first.weightKg) - 8}
            className="fill-[var(--color-muted-foreground)] text-[10px]"
          >
            {first.weightKg} kg
          </text>
        </>
      )}
      {last && (
        <>
          <circle cx={x(last.week)} cy={y(last.weightKg)} r={3.5} fill="var(--color-primary)" />
          <text
            x={x(last.week)}
            y={y(last.weightKg) - 8}
            textAnchor="end"
            className="fill-[var(--color-foreground)] text-[10px] font-medium"
          >
            {last.weightKg} kg
          </text>
        </>
      )}
    </svg>
  );
}
