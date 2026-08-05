/**
 * Deterministic fasting arithmetic.
 *
 * Per CLAUDE.md §5 nothing here may come from an LLM: elapsed time, progress,
 * remaining time and the phase a fast is in are all pure functions over plain
 * numbers and Dates, unit-tested in isolation. The UI renders what this module
 * returns and computes nothing of its own.
 *
 * Bounds mirror the `fasting_sessions` check constraint
 * (`target_hours > 0 and target_hours <= 72`) so an input the DB would reject
 * is rejected one layer earlier, with a message the user can act on.
 */

export const FASTING_PROTOCOLS = ['12:12', '14:10', '16:8', '18:6', '20:4', 'custom'] as const;

export type FastingProtocol = (typeof FASTING_PROTOCOLS)[number];

export const MIN_TARGET_HOURS = 1;
export const MAX_TARGET_HOURS = 72;

export const MS_PER_HOUR = 3_600_000;

export interface ProtocolPreset {
  protocol: Exclude<FastingProtocol, 'custom'>;
  targetHours: number;
  /** Short label for the picker pill. */
  label: string;
  /** One-line orientation shown under the picker. */
  description: string;
}

/**
 * The presets a user can pick with one tap. `targetHours` is the fasting half
 * of each ratio, which is what the timer counts; the eating half is implied.
 */
export const PROTOCOL_PRESETS: readonly ProtocolPreset[] = [
  {
    protocol: '12:12',
    targetHours: 12,
    label: '12:12',
    description: 'Punto de entrada. 12 horas de ayuno, 12 de ventana de comida.',
  },
  {
    protocol: '14:10',
    targetHours: 14,
    label: '14:10',
    description: 'Un paso intermedio antes del 16:8.',
  },
  {
    protocol: '16:8',
    targetHours: 16,
    label: '16:8',
    description: 'El protocolo más usado. 16 horas de ayuno, ventana de 8.',
  },
  {
    protocol: '18:6',
    targetHours: 18,
    label: '18:6',
    description: 'Ventana de comida de 6 horas.',
  },
  {
    protocol: '20:4',
    targetHours: 20,
    label: '20:4',
    description: 'Ventana corta de 4 horas. Exigente si no tienes práctica.',
  },
] as const;

/** Target hours for a preset, or null for 'custom' (the user sets it). */
export function targetHoursForProtocol(protocol: FastingProtocol): number | null {
  const preset = PROTOCOL_PRESETS.find((p) => p.protocol === protocol);
  return preset ? preset.targetHours : null;
}

/**
 * Milliseconds elapsed since `startAt`, clamped at 0.
 *
 * The clamp matters: a device whose clock is behind the server would otherwise
 * render a negative timer. A fast that has not started yet reads as 00:00:00.
 */
export function elapsedMs(startAt: Date, now: Date = new Date()): number {
  return Math.max(0, now.getTime() - startAt.getTime());
}

/** Duration of a finished fast; for an open one, the time up to `now`. */
export function durationMs(startAt: Date, endAt: Date | null, now: Date = new Date()): number {
  return Math.max(0, (endAt ?? now).getTime() - startAt.getTime());
}

export function targetMs(targetHours: number): number {
  return targetHours * MS_PER_HOUR;
}

/**
 * Progress toward the target as a percentage capped at 100, so the ring never
 * overdraws. Overshoot is surfaced as text, not as a longer arc.
 */
export function fastProgressPct(elapsed: number, targetHours: number): number {
  const total = targetMs(targetHours);
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

/** Milliseconds left to reach the target; 0 once the target is met. */
export function remainingMs(elapsed: number, targetHours: number): number {
  return Math.max(0, targetMs(targetHours) - elapsed);
}

/** Milliseconds past the target; 0 while still short of it. */
export function overshootMs(elapsed: number, targetHours: number): number {
  return Math.max(0, elapsed - targetMs(targetHours));
}

export function isGoalReached(elapsed: number, targetHours: number): boolean {
  return elapsed >= targetMs(targetHours);
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Running-clock format `H:MM:SS` (hours are not padded, so a long fast reads
 * naturally at 3 digits). Truncates rather than rounds: a timer must never show
 * a second that has not fully elapsed.
 */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${hours}:${pad2(minutes)}:${pad2(seconds)}`;
}

/** Human summary for history rows and remaining-time copy: `16 h 4 min`. */
export function formatCompactDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

export interface FastingPhase {
  key: 'digestion' | 'glycogen' | 'transition' | 'ketosis' | 'extended';
  /** Hour at which this phase begins. */
  fromHours: number;
  label: string;
  detail: string;
}

/**
 * Approximate metabolic phases of a fast.
 *
 * These boundaries are orientative, not diagnostic. The real transitions depend
 * on the last meal's composition, glycogen stores, activity and individual
 * metabolism, and the published ranges vary between sources. The copy is
 * deliberately descriptive and hedged, and the UI labels the section as
 * orientative, because CLAUDE.md ranks scientific correctness first and this is
 * the one part of the feature where overclaiming would be easy.
 */
export const FASTING_PHASES: readonly FastingPhase[] = [
  {
    key: 'digestion',
    fromHours: 0,
    label: 'Digestión',
    detail: 'Tu cuerpo sigue absorbiendo y usando la energía de la última comida.',
  },
  {
    key: 'glycogen',
    fromHours: 4,
    label: 'Reservas de glucógeno',
    detail: 'La glucosa en sangre baja y el hígado empieza a liberar sus reservas.',
  },
  {
    key: 'transition',
    fromHours: 12,
    label: 'Transición',
    detail: 'El glucógeno hepático se va agotando y sube el uso de grasa como combustible.',
  },
  {
    key: 'ketosis',
    fromHours: 16,
    label: 'Cetosis temprana',
    detail: 'Suele aumentar la producción de cuerpos cetónicos. Es la franja del 16:8.',
  },
  {
    key: 'extended',
    fromHours: 24,
    label: 'Ayuno prolongado',
    detail: 'Por encima de 24 horas conviene hacerlo con seguimiento profesional.',
  },
] as const;

/**
 * The phase a fast of `elapsed` milliseconds is in. Always returns a phase:
 * anything below the first boundary falls into `digestion`.
 */
export function fastingPhaseAt(elapsed: number): FastingPhase {
  const hours = Math.max(0, elapsed) / MS_PER_HOUR;

  let current: FastingPhase | undefined;
  for (const phase of FASTING_PHASES) {
    if (hours >= phase.fromHours) current = phase;
  }

  // `hours` is clamped at 0 and the table opens at hour 0, so a miss can only
  // mean the table itself was edited into an invalid shape.
  if (!current) {
    throw new Error('FASTING_PHASES must contain a phase starting at hour 0');
  }
  return current;
}

/**
 * When the fast will hit its target. Used for the "termina a las HH:MM" hint,
 * which is what a user actually plans around.
 */
export function targetReachedAt(startAt: Date, targetHours: number): Date {
  return new Date(startAt.getTime() + targetMs(targetHours));
}
