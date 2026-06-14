/**
 * Option metadata for the onboarding wizard. Plain data (no 'use client') so it
 * can be shared by the client wizard and any server-rendered summary. Each
 * description is kept under seven words per the product brief.
 */

export interface Option<T extends string> {
  value: T;
  label: string;
  description: string;
}

export const GOAL_OPTIONS: Option<'lose_fat' | 'gain_muscle' | 'maintain'>[] = [
  { value: 'lose_fat', label: 'Perder grasa', description: 'Baja de peso conservando músculo.' },
  { value: 'gain_muscle', label: 'Ganar músculo', description: 'Crece fuerte con superávit controlado.' },
  { value: 'maintain', label: 'Mantener peso', description: 'Sostén tu peso y composición.' },
];

export const METHOD_OPTIONS: Option<'meal_plan' | 'count_calories'>[] = [
  { value: 'meal_plan', label: 'Plan nutricional', description: 'NutriFlow arma tus comidas.' },
  { value: 'count_calories', label: 'Contar calorías', description: 'Registras tú, te guiamos.' },
];

export const SEX_OPTIONS: Option<'male' | 'female'>[] = [
  { value: 'male', label: 'Hombre', description: 'Para calcular tu metabolismo.' },
  { value: 'female', label: 'Mujer', description: 'Para calcular tu metabolismo.' },
];

export const ACTIVITY_OPTIONS: Option<'sedentary' | 'light' | 'active' | 'very_active'>[] = [
  { value: 'sedentary', label: 'Mayormente sentado', description: 'Escritorio casi todo el día.' },
  { value: 'light', label: 'A veces de pie', description: 'Caminas o te mueves algo.' },
  { value: 'active', label: 'Mayormente de pie', description: 'En movimiento buena parte del día.' },
  { value: 'very_active', label: 'Trabajo físico', description: 'Esfuerzo físico intenso a diario.' },
];

export const DIET_OPTIONS: Option<'recommended' | 'high_protein' | 'low_carb' | 'keto'>[] = [
  { value: 'recommended', label: 'Recomendada', description: 'Balance que arma NutriFlow.' },
  { value: 'high_protein', label: 'Alta en proteína', description: 'Más proteína, ideal con pesas.' },
  { value: 'low_carb', label: 'Baja en carbos', description: 'Menos carbohidratos, más saciedad.' },
  { value: 'keto', label: 'Keto', description: 'Carbohidratos muy bajos, grasa alta.' },
];

export const PACE_OPTIONS: Option<'slow' | 'recommended' | 'fast'>[] = [
  { value: 'slow', label: 'Lento', description: 'Más cómodo y sostenible.' },
  { value: 'recommended', label: 'Recomendado', description: 'El mejor equilibrio para ti.' },
  { value: 'fast', label: 'Rápido', description: 'Resultados antes, mayor esfuerzo.' },
];

export const SUGGESTION_OPTIONS: Option<'recipes' | 'ingredients' | 'mixed'>[] = [
  { value: 'recipes', label: 'Recetas completas', description: 'Platos listos para preparar.' },
  { value: 'ingredients', label: 'Ingredientes sueltos', description: 'Tú combinas a tu gusto.' },
  { value: 'mixed', label: 'Una mezcla', description: 'Recetas e ingredientes.' },
];

export const FASTING_OPTIONS: Option<'never' | 'tried' | 'current' | 'want'>[] = [
  { value: 'never', label: 'Nunca', description: 'No lo he probado.' },
  { value: 'tried', label: 'Lo probé', description: 'Lo hice antes, no ahora.' },
  { value: 'current', label: 'Lo hago', description: 'Ayuno actualmente.' },
  { value: 'want', label: 'Quiero probarlo', description: 'Me interesa empezar.' },
];

/** Human labels for the read-only record / summary. */
export const GOAL_LABEL: Record<'lose_fat' | 'gain_muscle' | 'maintain', string> = {
  lose_fat: 'Perder grasa',
  gain_muscle: 'Ganar músculo',
  maintain: 'Mantener peso',
};

export const DIET_LABEL: Record<'recommended' | 'high_protein' | 'low_carb' | 'keto' | 'low_fat', string> = {
  recommended: 'Recomendada',
  high_protein: 'Alta en proteína',
  low_carb: 'Baja en carbos',
  keto: 'Keto',
  low_fat: 'Baja en grasa',
};

export const ACTIVITY_LABEL: Record<'sedentary' | 'light' | 'active' | 'very_active', string> = {
  sedentary: 'Mayormente sentado',
  light: 'A veces de pie',
  active: 'Mayormente de pie',
  very_active: 'Trabajo físico',
};
