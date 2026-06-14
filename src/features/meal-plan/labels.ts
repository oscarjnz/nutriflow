import type { PlanMealType } from '@/lib/nutrition/meal-plan';

/** Spanish labels for meal types, shared by the plan view and the record. */
export const MEAL_TYPE_LABEL: Record<PlanMealType, string> = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  dinner: 'Cena',
  snack: 'Snack',
};
