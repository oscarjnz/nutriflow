import { describe, expect, it } from 'vitest';

import {
  generateMealPlan,
  type MealPlanInput,
  type PlanFoodInput,
} from '@/lib/nutrition/meal-plan';

const FOODS: PlanFoodInput[] = [
  { id: 'p1', nameEs: 'Pechuga de pollo', category: 'protein', per100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 } },
  { id: 'p2', nameEs: 'Huevo', category: 'protein', per100g: { calories: 143, protein: 13, carbs: 1, fat: 10 } },
  { id: 'g1', nameEs: 'Arroz', category: 'grain', per100g: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3 } },
  { id: 'g2', nameEs: 'Avena', category: 'grain', per100g: { calories: 389, protein: 17, carbs: 66, fat: 7 } },
  { id: 'v1', nameEs: 'Brócoli', category: 'vegetable', per100g: { calories: 34, protein: 2.8, carbs: 7, fat: 0.4 } },
  { id: 'v2', nameEs: 'Tomate', category: 'vegetable', per100g: { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2 } },
  { id: 'f1', nameEs: 'Aceite de oliva', category: 'fat', per100g: { calories: 884, protein: 0, carbs: 0, fat: 100 } },
  { id: 'fr1', nameEs: 'Banana', category: 'fruit', per100g: { calories: 89, protein: 1.1, carbs: 23, fat: 0.3 } },
  { id: 'd1', nameEs: 'Yogurt', category: 'dairy', per100g: { calories: 61, protein: 3.5, carbs: 4.7, fat: 3.3 } },
];

const BASE: MealPlanInput = {
  calorieTarget: 2000,
  macros: { protein: 150, carbs: 200, fat: 67 },
  mealsPerDay: 3,
  mainMeals: 3,
  foods: FOODS,
};

describe('generateMealPlan', () => {
  it('produces exactly mealsPerDay meals', () => {
    expect(generateMealPlan(BASE).meals).toHaveLength(3);
    expect(generateMealPlan({ ...BASE, mealsPerDay: 5, mainMeals: 3 }).meals).toHaveLength(5);
  });

  it('labels main meals breakfast/lunch/dinner and the rest as snacks', () => {
    const plan = generateMealPlan({ ...BASE, mealsPerDay: 5, mainMeals: 3 });
    const types = plan.meals.map((m) => m.mealType);
    expect(types.slice(0, 3)).toEqual(['breakfast', 'lunch', 'dinner']);
    expect(types.slice(3)).toEqual(['snack', 'snack']);
  });

  it('is deterministic: same input yields an identical plan', () => {
    expect(generateMealPlan(BASE)).toEqual(generateMealPlan(BASE));
  });

  it('lands day calories within ~20% of the target', () => {
    const { totals } = generateMealPlan(BASE);
    const ratio = totals.calories / BASE.calorieTarget;
    expect(ratio).toBeGreaterThan(0.8);
    expect(ratio).toBeLessThan(1.2);
  });

  it('delivers a substantial share of the protein target', () => {
    const { totals } = generateMealPlan(BASE);
    expect(totals.protein).toBeGreaterThan(BASE.macros.protein * 0.7);
  });

  it('every meal totals equal the sum of its item macros', () => {
    for (const meal of generateMealPlan(BASE).meals) {
      const sum = meal.items.reduce((a, i) => a + i.calories, 0);
      expect(meal.totals.calories).toBeCloseTo(sum, 1);
    }
  });

  it('rotates protein sources across meals for variety', () => {
    const plan = generateMealPlan(BASE);
    const proteinIds = plan.meals.map((m) => m.items.find((i) => i.foodId.startsWith('p'))?.foodId);
    expect(new Set(proteinIds).size).toBeGreaterThan(1);
  });

  it('throws when there is no protein or grain to build from', () => {
    const onlyVeg = FOODS.filter((f) => f.category === 'vegetable');
    expect(() => generateMealPlan({ ...BASE, foods: onlyVeg })).toThrow();
  });

  it('still builds when optional categories (fat, dairy, fruit) are absent', () => {
    const minimal = FOODS.filter((f) => ['protein', 'grain', 'vegetable'].includes(f.category));
    const plan = generateMealPlan({ ...BASE, foods: minimal });
    expect(plan.meals).toHaveLength(3);
    expect(plan.totals.calories).toBeGreaterThan(0);
  });
});
