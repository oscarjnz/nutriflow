/**
 * Deterministic body-composition and energy engine.
 *
 * Per CLAUDE.md priority #1 (scientific correctness) and §5, every figure a user
 * acts on (BMR, TDEE, calorie target, macros, projected weight) is computed here
 * in pure TypeScript and unit-tested. No LLM ever touches these numbers.
 *
 * Formulae and defaults are evidence-informed:
 *   - BMR: Mifflin-St Jeor (the most accurate predictive equation for the
 *     general population).
 *   - TDEE: BMR x PAL, where PAL is a NEAT base (daily non-exercise movement)
 *     plus a per-session increment for training. We keep NEAT and exercise as
 *     separate inputs because they move energy expenditure independently.
 *   - Rate of change: bounded to safe weekly fractions of bodyweight, with an
 *     absolute calorie floor so an aggressive target never prescribes an
 *     unhealthy intake.
 *   - Macros: protein scaled by bodyweight and training status (higher in a
 *     deficit to preserve lean mass), fat kept above an essential floor, carbs
 *     as the remainder, with diet-preference overrides.
 */

export type Sex = 'male' | 'female';
export type Goal = 'lose_fat' | 'gain_muscle' | 'maintain';
export type Pace = 'slow' | 'recommended' | 'fast';
/** NEAT bucket: daily movement EXCLUDING workouts. */
export type ActivityLevel = 'sedentary' | 'light' | 'active' | 'very_active';
export type Diet = 'recommended' | 'high_protein' | 'low_carb' | 'keto' | 'low_fat';

export interface BodyInput {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  goal: Goal;
  pace: Pace;
  activityLevel: ActivityLevel;
  /** Training sessions per week, 0..7. */
  trainingDays: number;
  /** Whether those sessions include resistance training (drives protein). */
  strengthTraining: boolean;
  diet: Diet;
}

export interface MacroTargets {
  protein: number;
  carbs: number;
  fat: number;
}

export interface BmiInfo {
  value: number;
  category: 'underweight' | 'normal' | 'overweight' | 'obese';
  healthyMinKg: number;
  healthyMaxKg: number;
}

export interface BodyPlan {
  bmr: number;
  tdee: number;
  bmi: BmiInfo;
  /** Daily calorie target after applying goal + pace, respecting safety floor. */
  calorieTarget: number;
  macros: MacroTargets;
  /** Signed kg/week the plan actually delivers after clamping (loss negative). */
  weeklyRateKg: number;
  /** Weeks to reach target weight at the effective rate; null when maintaining. */
  estimatedWeeks: number | null;
  /** Sampled weight trajectory for the progress chart (start + milestones). */
  projection: { week: number; weightKg: number }[];
}

// ── Tunable, evidence-informed constants ─────────────────────────────────────

/** PAL contribution from daily non-exercise movement (NEAT). */
const NEAT_PAL: Record<ActivityLevel, number> = {
  sedentary: 1.25,
  light: 1.35,
  active: 1.45,
  very_active: 1.55,
};
/** Each weekly training session adds this to PAL (capped via clamp below). */
const PAL_PER_SESSION = 0.025;
const PAL_MIN = 1.2;
const PAL_MAX = 2.2;

/** kcal per kg of body mass change (classic 7700 kcal/kg approximation). */
const KCAL_PER_KG = 7700;

/** Weekly loss as a fraction of bodyweight, by pace. */
const LOSS_PCT: Record<Pace, number> = { slow: 0.0035, recommended: 0.005, fast: 0.0075 };
/** Weekly lean-gain in kg, by pace (gain is intrinsically slower than loss). */
const GAIN_KG: Record<Pace, number> = { slow: 0.125, recommended: 0.25, fast: 0.4 };

/** Absolute minimum daily intake, by sex (never prescribe below this). */
const CALORIE_FLOOR: Record<Sex, number> = { male: 1500, female: 1200 };

/** Protein g per kg bodyweight: [no strength, strength]. */
const PROTEIN_PER_KG = { base: 1.4, strength: 1.8 };
/** Extra protein g/kg while in a deficit to protect lean mass. */
const PROTEIN_DEFICIT_BONUS = 0.2;
/** Essential fat floor, g per kg bodyweight. */
const FAT_FLOOR_PER_KG = 0.5;

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
function round(value: number): number {
  return Math.round(value);
}
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function assertFinitePositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`computeBodyPlan: ${name} must be a positive finite number, got ${value}`);
  }
}

// ── Public computations ──────────────────────────────────────────────────────

/** Mifflin-St Jeor basal metabolic rate (kcal/day). */
export function basalMetabolicRate(input: Pick<BodyInput, 'sex' | 'age' | 'heightCm' | 'weightKg'>): number {
  const { sex, age, heightCm, weightKg } = input;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return round(base + (sex === 'male' ? 5 : -161));
}

/** Physical Activity Level from NEAT bucket plus weekly training sessions. */
export function activityFactor(activityLevel: ActivityLevel, trainingDays: number): number {
  const sessions = clamp(Number.isFinite(trainingDays) ? trainingDays : 0, 0, 7);
  return round2(clamp(NEAT_PAL[activityLevel] + sessions * PAL_PER_SESSION, PAL_MIN, PAL_MAX));
}

export function bodyMassIndex(weightKg: number, heightCm: number): BmiInfo {
  const meters = heightCm / 100;
  const value = round2(weightKg / (meters * meters));
  const category: BmiInfo['category'] =
    value < 18.5 ? 'underweight' : value < 25 ? 'normal' : value < 30 ? 'overweight' : 'obese';
  return {
    value,
    category,
    healthyMinKg: round2(18.5 * meters * meters),
    healthyMaxKg: round2(24.9 * meters * meters),
  };
}

/**
 * Full plan: energy needs, calorie target for the chosen goal/pace (safety
 * clamped), macro split for the chosen diet, and the resulting weight timeline.
 */
export function computeBodyPlan(input: BodyInput): BodyPlan {
  assertFinitePositive('age', input.age);
  assertFinitePositive('heightCm', input.heightCm);
  assertFinitePositive('weightKg', input.weightKg);
  assertFinitePositive('targetWeightKg', input.targetWeightKg);

  const bmr = basalMetabolicRate(input);
  const pal = activityFactor(input.activityLevel, input.trainingDays);
  const tdee = round(bmr * pal);
  const bmi = bodyMassIndex(input.weightKg, input.heightCm);

  const { calorieTarget, weeklyRateKg } = energyTarget(input, bmr, tdee);
  const macros = macroTargets(input, calorieTarget);
  const estimatedWeeks = weeksToTarget(input.weightKg, input.targetWeightKg, weeklyRateKg);
  const projection = buildProjection(input.weightKg, input.targetWeightKg, weeklyRateKg, estimatedWeeks);

  return { bmr, tdee, bmi, calorieTarget, macros, weeklyRateKg, estimatedWeeks, projection };
}

// ── Internals ────────────────────────────────────────────────────────────────

function energyTarget(
  input: BodyInput,
  bmr: number,
  tdee: number,
): { calorieTarget: number; weeklyRateKg: number } {
  if (input.goal === 'maintain') {
    return { calorieTarget: tdee, weeklyRateKg: 0 };
  }

  // Desired weekly change (signed): loss is negative, gain positive.
  const desiredWeekly =
    input.goal === 'lose_fat'
      ? -(input.weightKg * LOSS_PCT[input.pace])
      : GAIN_KG[input.pace];

  const desiredDailyDelta = (desiredWeekly * KCAL_PER_KG) / 7;
  const rawTarget = tdee + desiredDailyDelta;

  // Safety: never below an absolute floor or 90% of BMR; surplus is uncapped
  // beyond TDEE (overfeeding is self-limiting and far less risky than starving).
  const floor = Math.max(CALORIE_FLOOR[input.sex], round(bmr * 0.9));
  const calorieTarget = round(Math.max(rawTarget, floor));

  // Recompute the rate the *clamped* target actually delivers, so the timeline
  // shown to the user matches the prescribed intake rather than the wish.
  const effectiveDailyDelta = calorieTarget - tdee;
  const weeklyRateKg = round2((effectiveDailyDelta * 7) / KCAL_PER_KG);

  return { calorieTarget, weeklyRateKg };
}

function macroTargets(input: BodyInput, calorieTarget: number): MacroTargets {
  const { weightKg, strengthTraining, goal, diet } = input;

  let proteinPerKg = strengthTraining ? PROTEIN_PER_KG.strength : PROTEIN_PER_KG.base;
  if (goal === 'lose_fat') proteinPerKg += PROTEIN_DEFICIT_BONUS;
  if (diet === 'high_protein') proteinPerKg = Math.max(proteinPerKg, 2.2);
  if (diet === 'keto') proteinPerKg = strengthTraining ? 1.8 : 1.5;

  const proteinG = round(proteinPerKg * weightKg);
  const proteinKcal = proteinG * 4;
  const fatFloorG = round(FAT_FLOOR_PER_KG * weightKg);

  let fatG: number;
  switch (diet) {
    case 'keto':
      // Carbs fixed very low; fat fills whatever protein leaves.
      fatG = Math.max(fatFloorG, round((calorieTarget - proteinKcal - 25 * 4) / 9));
      break;
    case 'low_fat':
      fatG = Math.max(fatFloorG, round((calorieTarget * 0.2) / 9));
      break;
    case 'low_carb':
      // ~20% of energy from carbs, fat takes the rest.
      fatG = Math.max(fatFloorG, round((calorieTarget - proteinKcal - calorieTarget * 0.2) / 9));
      break;
    default:
      // Balanced: ~27.5% of energy from fat.
      fatG = Math.max(fatFloorG, round((calorieTarget * 0.275) / 9));
  }

  const carbsKcal = calorieTarget - proteinKcal - fatG * 9;
  const carbsG = Math.max(0, round(carbsKcal / 4));

  return { protein: proteinG, carbs: carbsG, fat: fatG };
}

function weeksToTarget(weightKg: number, targetKg: number, weeklyRateKg: number): number | null {
  if (weeklyRateKg === 0) return null;
  const delta = targetKg - weightKg;
  // If the goal direction and the rate disagree (e.g. target above current while
  // losing), there is no finite ETA in that direction.
  if (Math.sign(delta) !== Math.sign(weeklyRateKg)) return null;
  return Math.max(1, Math.ceil(Math.abs(delta) / Math.abs(weeklyRateKg)));
}

/** Up to ~9 evenly spaced points from start weight toward target, for the chart. */
function buildProjection(
  weightKg: number,
  targetKg: number,
  weeklyRateKg: number,
  estimatedWeeks: number | null,
): { week: number; weightKg: number }[] {
  if (estimatedWeeks === null || weeklyRateKg === 0) {
    return [{ week: 0, weightKg: round2(weightKg) }];
  }
  const points = Math.min(estimatedWeeks, 8);
  const step = estimatedWeeks / points;
  const out: { week: number; weightKg: number }[] = [{ week: 0, weightKg: round2(weightKg) }];
  for (let i = 1; i <= points; i += 1) {
    const week = Math.round(step * i);
    const projected = weightKg + weeklyRateKg * week;
    // Do not overshoot the target on the final/intermediate samples.
    const clamped = weeklyRateKg < 0 ? Math.max(projected, targetKg) : Math.min(projected, targetKg);
    out.push({ week, weightKg: round2(clamped) });
  }
  return out;
}
