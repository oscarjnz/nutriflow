import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Drizzle schema mirrors the DDL applied by `supabase/migrations/*.sql`.
 * SQL is the source of truth; this file exists to give the application
 * type-safe queries. `drizzle-kit generate` is intentionally not used —
 * RLS policies, generated columns, triggers, and extensions all live in
 * hand-written SQL so we keep a single source of truth for migrations.
 *
 * Column names are camelCase here and mapped to snake_case in SQL via the
 * `casing: 'snake_case'` option in `drizzle.config.ts`.
 */

// ─── Catalog (public read, service_role write) ──────────────────────────────

export const foods = pgTable(
  'foods',
  {
    id: uuid().primaryKey(),
    nameEn: text().notNull(),
    nameEs: text().notNull(),
    source: text().notNull().$type<'usda' | 'off' | 'manual'>(),
    fdcId: integer(),
    barcode: text(),
    calories: numeric({ precision: 8, scale: 2, mode: 'number' }).notNull(),
    protein: numeric({ precision: 8, scale: 2, mode: 'number' }).notNull(),
    carbs: numeric({ precision: 8, scale: 2, mode: 'number' }).notNull(),
    fat: numeric({ precision: 8, scale: 2, mode: 'number' }).notNull(),
    fiber: numeric({ precision: 8, scale: 2, mode: 'number' }),
    sugar: numeric({ precision: 8, scale: 2, mode: 'number' }),
    sodium: numeric({ precision: 8, scale: 2, mode: 'number' }),
    servingSize: numeric({ precision: 8, scale: 2, mode: 'number' }).notNull(),
    servingUnit: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check('foods_source_check', sql`${t.source} in ('usda','off','manual')`),
    index('foods_fdc_id_idx').on(t.fdcId),
    index('foods_barcode_idx').on(t.barcode),
  ],
);

export const foodAliases = pgTable(
  'food_aliases',
  {
    id: uuid().primaryKey(),
    foodId: uuid()
      .notNull()
      .references(() => foods.id, { onDelete: 'cascade' }),
    aliasText: text().notNull(),
    locale: text().notNull().default('es'),
    confidence: numeric({ precision: 3, scale: 2, mode: 'number' }).notNull().default(1.0),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('food_aliases_unique').on(t.foodId, t.aliasText, t.locale),
    index('food_aliases_food_id_idx').on(t.foodId),
  ],
);

export const barcodes = pgTable(
  'barcodes',
  {
    id: uuid().primaryKey(),
    foodId: uuid()
      .notNull()
      .references(() => foods.id, { onDelete: 'cascade' }),
    barcode: text().notNull(),
    source: text().notNull().$type<'usda' | 'off' | 'manual'>(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('barcodes_barcode_unique').on(t.barcode),
    index('barcodes_food_id_idx').on(t.foodId),
  ],
);

export const foodServings = pgTable(
  'food_servings',
  {
    id: uuid().primaryKey(),
    foodId: uuid()
      .notNull()
      .references(() => foods.id, { onDelete: 'cascade' }),
    label: text().notNull(),
    grams: numeric({ precision: 8, scale: 2, mode: 'number' }).notNull(),
    isDefault: boolean().notNull().default(false),
  },
  (t) => [
    unique('food_servings_label_unique').on(t.foodId, t.label),
    index('food_servings_food_id_idx').on(t.foodId),
  ],
);

// ─── NLP cache (service_role only) ──────────────────────────────────────────

export const nlpCache = pgTable(
  'nlp_cache',
  {
    id: uuid().primaryKey(),
    inputHash: text().notNull(),
    inputText: text().notNull(),
    model: text().notNull(),
    parsedResult: jsonb().notNull(),
    hitCount: integer().notNull().default(1),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    lastHitAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('nlp_cache_hash_model_unique').on(t.inputHash, t.model),
    index('nlp_cache_last_hit_idx').on(t.lastHitAt),
  ],
);

// ─── User profile & settings ────────────────────────────────────────────────
//
// `users.id` references `auth.users(id)`. The row is created automatically
// by the `handle_new_auth_user()` trigger declared in the user_tables
// migration. The application never inserts into `users` directly.

export const users = pgTable('users', {
  id: uuid().primaryKey(),
  displayName: text(),
  locale: text().notNull().default('es'),
  units: text().notNull().default('metric').$type<'metric' | 'imperial'>(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

export const userSettings = pgTable('user_settings', {
  userId: uuid()
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  theme: text().notNull().default('system').$type<'system' | 'light' | 'dark'>(),
  remindersEnabled: boolean().notNull().default(true),
  privacyShareAnonAliases: boolean().notNull().default(false),
  updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

export const userGoals = pgTable(
  'user_goals',
  {
    id: uuid().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    calorieTarget: integer().notNull(),
    proteinTarget: integer().notNull(),
    carbsTarget: integer().notNull(),
    fatTarget: integer().notNull(),
    weightTargetKg: numeric({ precision: 5, scale: 2, mode: 'number' }),
    active: boolean().notNull().default(true),
    startsOn: date().notNull(),
    endsOn: date(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('user_goals_user_active_idx').on(t.userId)],
);

// ─── Meal logging ───────────────────────────────────────────────────────────

export const mealLogs = pgTable(
  'meal_logs',
  {
    id: uuid().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    loggedAt: timestamp({ withTimezone: true }).notNull(),
    mealType: text().notNull().$type<'breakfast' | 'lunch' | 'dinner' | 'snack'>(),
    notes: text(),
    synced: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index('meal_logs_user_logged_idx').on(t.userId, t.loggedAt)],
);

export const mealItems = pgTable(
  'meal_items',
  {
    id: uuid().primaryKey(),
    mealLogId: uuid()
      .notNull()
      .references(() => mealLogs.id, { onDelete: 'cascade' }),
    foodId: uuid()
      .notNull()
      .references(() => foods.id, { onDelete: 'restrict' }),
    quantity: numeric({ precision: 8, scale: 2, mode: 'number' }).notNull(),
    unit: text().notNull(),
    quantityGrams: numeric({ precision: 8, scale: 2, mode: 'number' }).notNull(),
    source: text().notNull().$type<'manual' | 'nlp' | 'barcode' | 'recipe' | 'favorite'>(),
    caloriesSnapshot: numeric({ precision: 8, scale: 2, mode: 'number' }).notNull(),
    proteinSnapshot: numeric({ precision: 8, scale: 2, mode: 'number' }).notNull(),
    carbsSnapshot: numeric({ precision: 8, scale: 2, mode: 'number' }).notNull(),
    fatSnapshot: numeric({ precision: 8, scale: 2, mode: 'number' }).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index('meal_items_meal_log_idx').on(t.mealLogId),
    index('meal_items_food_idx').on(t.foodId),
  ],
);

// ─── Recipes & favorites ────────────────────────────────────────────────────

export const recipes = pgTable(
  'recipes',
  {
    id: uuid().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    servings: integer().notNull().default(1),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index('recipes_user_idx').on(t.userId)],
);

export const recipeItems = pgTable(
  'recipe_items',
  {
    id: uuid().primaryKey(),
    recipeId: uuid()
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    foodId: uuid()
      .notNull()
      .references(() => foods.id, { onDelete: 'restrict' }),
    quantity: numeric({ precision: 8, scale: 2, mode: 'number' }).notNull(),
    unit: text().notNull(),
  },
  (t) => [index('recipe_items_recipe_idx').on(t.recipeId)],
);

export const favorites = pgTable(
  'favorites',
  {
    id: uuid().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    foodId: uuid().references(() => foods.id, { onDelete: 'cascade' }),
    recipeId: uuid().references(() => recipes.id, { onDelete: 'cascade' }),
    label: text().notNull(),
    position: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check(
      'favorites_one_target',
      sql`num_nonnulls(${t.foodId}, ${t.recipeId}) = 1`,
    ),
    index('favorites_user_position_idx').on(t.userId, t.position),
  ],
);

// ─── Body metrics & fasting ─────────────────────────────────────────────────

export const fastingSessions = pgTable(
  'fasting_sessions',
  {
    id: uuid().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    startAt: timestamp({ withTimezone: true }).notNull(),
    endAt: timestamp({ withTimezone: true }),
    targetHours: integer().notNull(),
    protocol: text()
      .notNull()
      .$type<'12:12' | '14:10' | '16:8' | '18:6' | '20:4' | 'custom'>(),
    notes: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index('fasting_user_start_idx').on(t.userId, t.startAt)],
);

export const weightLogs = pgTable(
  'weight_logs',
  {
    id: uuid().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    weightKg: numeric({ precision: 5, scale: 2, mode: 'number' }).notNull(),
    bodyFatPct: numeric({ precision: 4, scale: 2, mode: 'number' }),
    waistCm: numeric({ precision: 5, scale: 2, mode: 'number' }),
    neckCm: numeric({ precision: 5, scale: 2, mode: 'number' }),
    hipsCm: numeric({ precision: 5, scale: 2, mode: 'number' }),
    loggedAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index('weight_logs_user_logged_idx').on(t.userId, t.loggedAt)],
);

export const userStreaks = pgTable(
  'user_streaks',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    streakType: text().notNull().$type<'logging' | 'fasting'>(),
    currentCount: integer().notNull().default(0),
    longestCount: integer().notNull().default(0),
    lastLoggedDate: date(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.streakType] })],
);

// ─── Aggregate schema export ────────────────────────────────────────────────

export const schema = {
  foods,
  foodAliases,
  barcodes,
  foodServings,
  nlpCache,
  users,
  userSettings,
  userGoals,
  mealLogs,
  mealItems,
  recipes,
  recipeItems,
  favorites,
  fastingSessions,
  weightLogs,
  userStreaks,
} as const;
