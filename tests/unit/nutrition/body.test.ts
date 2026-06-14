import { describe, expect, it } from 'vitest';

import {
  activityFactor,
  basalMetabolicRate,
  bodyMassIndex,
  type BodyInput,
  computeBodyPlan,
} from '@/lib/nutrition/body';

const baseInput: BodyInput = {
  sex: 'male',
  age: 30,
  heightCm: 180,
  weightKg: 80,
  targetWeightKg: 75,
  goal: 'lose_fat',
  pace: 'recommended',
  activityLevel: 'sedentary',
  trainingDays: 0,
  strengthTraining: false,
  diet: 'recommended',
};

describe('basalMetabolicRate (Mifflin-St Jeor)', () => {
  it('matches the male formula', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 1780
    expect(basalMetabolicRate({ sex: 'male', age: 30, heightCm: 180, weightKg: 80 })).toBe(1780);
  });

  it('matches the female formula', () => {
    // 10*65 + 6.25*165 - 5*28 - 161 = 1380.25 -> 1380
    expect(basalMetabolicRate({ sex: 'female', age: 28, heightCm: 165, weightKg: 65 })).toBe(1380);
  });
});

describe('activityFactor', () => {
  it('uses the NEAT base when there is no training', () => {
    expect(activityFactor('sedentary', 0)).toBe(1.25);
  });

  it('adds a per-session increment', () => {
    // 1.35 + 4 * 0.025 = 1.45
    expect(activityFactor('light', 4)).toBe(1.45);
  });

  it('clamps within physiological bounds', () => {
    expect(activityFactor('very_active', 7)).toBeLessThanOrEqual(2.2);
    expect(activityFactor('sedentary', -5)).toBe(1.25);
  });
});

describe('bodyMassIndex', () => {
  it('computes value and category', () => {
    const bmi = bodyMassIndex(80, 180);
    expect(bmi.value).toBeCloseTo(24.69, 1);
    expect(bmi.category).toBe('normal');
  });

  it('flags obesity and gives a healthy range', () => {
    const bmi = bodyMassIndex(110, 175);
    expect(bmi.category).toBe('obese');
    expect(bmi.healthyMinKg).toBeGreaterThan(50);
    expect(bmi.healthyMaxKg).toBeGreaterThan(bmi.healthyMinKg);
  });
});

describe('computeBodyPlan', () => {
  it('produces a deficit for fat loss and an energy-consistent macro split', () => {
    const plan = computeBodyPlan(baseInput);
    expect(plan.bmr).toBe(1780);
    expect(plan.tdee).toBe(Math.round(1780 * 1.25)); // 2225
    expect(plan.calorieTarget).toBeLessThan(plan.tdee);
    expect(plan.weeklyRateKg).toBeLessThan(0);

    // Macro kcal should reconcile with the calorie target within rounding.
    const macroKcal = plan.macros.protein * 4 + plan.macros.carbs * 4 + plan.macros.fat * 9;
    expect(Math.abs(macroKcal - plan.calorieTarget)).toBeLessThanOrEqual(12);
  });

  it('targets maintenance exactly at TDEE with no weight change', () => {
    const plan = computeBodyPlan({ ...baseInput, goal: 'maintain', targetWeightKg: 80 });
    expect(plan.calorieTarget).toBe(plan.tdee);
    expect(plan.weeklyRateKg).toBe(0);
    expect(plan.estimatedWeeks).toBeNull();
  });

  it('produces a surplus for muscle gain', () => {
    const plan = computeBodyPlan({
      ...baseInput,
      goal: 'gain_muscle',
      targetWeightKg: 85,
      strengthTraining: true,
      trainingDays: 4,
    });
    expect(plan.calorieTarget).toBeGreaterThan(plan.tdee);
    expect(plan.weeklyRateKg).toBeGreaterThan(0);
    expect(plan.estimatedWeeks).toBeGreaterThan(0);
  });

  it('never prescribes below the safety floor', () => {
    const plan = computeBodyPlan({
      ...baseInput,
      sex: 'female',
      weightKg: 55,
      targetWeightKg: 48,
      pace: 'fast',
      activityLevel: 'sedentary',
    });
    expect(plan.calorieTarget).toBeGreaterThanOrEqual(1200);
  });

  it('raises protein for strength training and even more in a deficit', () => {
    const noStrength = computeBodyPlan(baseInput);
    const strength = computeBodyPlan({ ...baseInput, strengthTraining: true });
    expect(strength.macros.protein).toBeGreaterThan(noStrength.macros.protein);
    // lose_fat + strength -> 2.0 g/kg * 80 = 160
    expect(strength.macros.protein).toBe(160);
  });

  it('keeps keto carbohydrates very low', () => {
    const plan = computeBodyPlan({ ...baseInput, diet: 'keto' });
    expect(plan.macros.carbs).toBeLessThanOrEqual(30);
    expect(plan.macros.fat).toBeGreaterThan(plan.macros.protein);
  });

  it('builds a monotonic projection that ends at the target', () => {
    const plan = computeBodyPlan(baseInput);
    expect(plan.projection[0]?.weightKg).toBe(80);
    const last = plan.projection[plan.projection.length - 1];
    expect(last?.weightKg).toBeCloseTo(75, 0);
  });

  it('rejects non-physical input', () => {
    expect(() => computeBodyPlan({ ...baseInput, weightKg: 0 })).toThrow(RangeError);
    expect(() => computeBodyPlan({ ...baseInput, heightCm: -1 })).toThrow(RangeError);
  });
});
