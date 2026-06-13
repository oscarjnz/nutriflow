import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import type {
  barcodes,
  fastingSessions,
  favorites,
  foodAliases,
  foodServings,
  foods,
  mealItems,
  mealLogs,
  nlpCache,
  recipeItems,
  recipes,
  userGoals,
  userSettings,
  userStreaks,
  users,
  weightLogs,
} from './schema';

export type Food = InferSelectModel<typeof foods>;
export type NewFood = InferInsertModel<typeof foods>;

export type FoodAlias = InferSelectModel<typeof foodAliases>;
export type NewFoodAlias = InferInsertModel<typeof foodAliases>;

export type Barcode = InferSelectModel<typeof barcodes>;
export type NewBarcode = InferInsertModel<typeof barcodes>;

export type FoodServing = InferSelectModel<typeof foodServings>;
export type NewFoodServing = InferInsertModel<typeof foodServings>;

export type NlpCacheEntry = InferSelectModel<typeof nlpCache>;
export type NewNlpCacheEntry = InferInsertModel<typeof nlpCache>;

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type UserSettings = InferSelectModel<typeof userSettings>;
export type NewUserSettings = InferInsertModel<typeof userSettings>;

export type UserGoal = InferSelectModel<typeof userGoals>;
export type NewUserGoal = InferInsertModel<typeof userGoals>;

export type MealLog = InferSelectModel<typeof mealLogs>;
export type NewMealLog = InferInsertModel<typeof mealLogs>;

export type MealItem = InferSelectModel<typeof mealItems>;
export type NewMealItem = InferInsertModel<typeof mealItems>;

export type Recipe = InferSelectModel<typeof recipes>;
export type NewRecipe = InferInsertModel<typeof recipes>;

export type RecipeItem = InferSelectModel<typeof recipeItems>;
export type NewRecipeItem = InferInsertModel<typeof recipeItems>;

export type Favorite = InferSelectModel<typeof favorites>;
export type NewFavorite = InferInsertModel<typeof favorites>;

export type FastingSession = InferSelectModel<typeof fastingSessions>;
export type NewFastingSession = InferInsertModel<typeof fastingSessions>;

export type WeightLog = InferSelectModel<typeof weightLogs>;
export type NewWeightLog = InferInsertModel<typeof weightLogs>;

export type UserStreak = InferSelectModel<typeof userStreaks>;
export type NewUserStreak = InferInsertModel<typeof userStreaks>;
