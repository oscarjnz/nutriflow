import { describe, expect, it } from 'vitest';

import {
  atwaterCalories,
  computeMacros,
  type Macros,
  type MacrosPer100g,
  remainingAgainstTarget,
  round2,
  sumMacros,
} from '@/lib/nutrition/macros';

const chickenPer100g: MacrosPer100g = {
  calories: 165,
  protein: 31,
  carbs: 0,
  fat: 3.57,
  fiber: 0,
  sugar: 0,
  sodium: 74,
};

describe('round2', () => {
  it('rounds to 2 decimals without float drift', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.674999)).toBe(2.67);
    expect(round2(10)).toBe(10);
  });
});

describe('computeMacros', () => {
  it('scales per-100g macros to grams', () => {
    const result = computeMacros(chickenPer100g, 150);
    expect(result).toEqual<Macros>({
      calories: 247.5,
      protein: 46.5,
      carbs: 0,
      fat: 5.36,
      fiber: 0,
      sugar: 0,
      sodium: 111,
    });
  });

  it('returns zeros for 0 grams', () => {
    const result = computeMacros(chickenPer100g, 0);
    expect(result.calories).toBe(0);
    expect(result.protein).toBe(0);
  });

  it('preserves null optional fields', () => {
    const result = computeMacros(
      { calories: 100, protein: 1, carbs: 2, fat: 3, fiber: null, sugar: undefined, sodium: 5 },
      200,
    );
    expect(result.fiber).toBeNull();
    expect(result.sugar).toBeNull();
    expect(result.sodium).toBe(10);
  });

  it('throws on negative or non-finite grams', () => {
    expect(() => computeMacros(chickenPer100g, -1)).toThrow(RangeError);
    expect(() => computeMacros(chickenPer100g, Number.NaN)).toThrow(RangeError);
  });
});

describe('sumMacros', () => {
  it('sums an empty list to zeros with null optionals', () => {
    expect(sumMacros([])).toEqual<Macros>({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: null,
      sugar: null,
      sodium: null,
    });
  });

  it('adds calories/macros and only present optionals', () => {
    const a: Macros = {
      calories: 100,
      protein: 10,
      carbs: 5,
      fat: 2,
      fiber: 1,
      sugar: null,
      sodium: 50,
    };
    const b: Macros = {
      calories: 200,
      protein: 20,
      carbs: 10,
      fat: 4,
      fiber: null,
      sugar: 3,
      sodium: null,
    };
    expect(sumMacros([a, b])).toEqual<Macros>({
      calories: 300,
      protein: 30,
      carbs: 15,
      fat: 6,
      fiber: 1,
      sugar: 3,
      sodium: 50,
    });
  });
});

describe('atwaterCalories', () => {
  it('applies 4/4/9 kcal per gram', () => {
    expect(atwaterCalories(31, 0, 3.57)).toBe(156.13);
  });
});

describe('remainingAgainstTarget', () => {
  it('returns positive remaining when under target', () => {
    const remaining = remainingAgainstTarget(
      { calories: 500, protein: 40, carbs: 50, fat: 20 },
      { calories: 2000, protein: 150, carbs: 200, fat: 70 },
    );
    expect(remaining).toEqual({ calories: 1500, protein: 110, carbs: 150, fat: 50 });
  });

  it('returns negative when target exceeded', () => {
    const remaining = remainingAgainstTarget(
      { calories: 2200, protein: 0, carbs: 0, fat: 0 },
      { calories: 2000, protein: 0, carbs: 0, fat: 0 },
    );
    expect(remaining.calories).toBe(-200);
  });
});
