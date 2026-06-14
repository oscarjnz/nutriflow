-- ─────────────────────────────────────────────────────────────────────────────
-- 0012 — user_profiles
--
-- One row per user holding the onboarding answers AND the deterministic plan
-- snapshot (BMR/TDEE/BMI/targets) computed from them by src/lib/nutrition/body.ts.
-- The snapshot is denormalized here so the dashboard, the exportable record, and
-- the meal generator all read a single source of truth without recomputing.
--
-- `onboarding_completed` gates the app: users without it are routed to the
-- guided wizard. Idempotent (safe to paste in Supabase / re-run).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.user_profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  record_name text,

  -- Goal & method
  goal text not null check (goal in ('lose_fat', 'gain_muscle', 'maintain')),
  method text not null check (method in ('meal_plan', 'count_calories')),

  -- Personal metrics
  sex text not null check (sex in ('male', 'female')),
  age integer not null check (age between 14 and 100),
  height_cm numeric(5, 1) not null check (height_cm between 100 and 250),
  weight_kg numeric(5, 2) not null check (weight_kg between 30 and 350),
  target_weight_kg numeric(5, 2) not null check (target_weight_kg between 30 and 350),
  pace text not null check (pace in ('slow', 'recommended', 'fast')),

  -- Activity & training
  activity_level text not null check (activity_level in ('sedentary', 'light', 'active', 'very_active')),
  training_days integer not null default 0 check (training_days between 0 and 7),
  strength_training boolean not null default false,

  -- Diet preference & display
  diet text not null check (diet in ('recommended', 'high_protein', 'low_carb', 'keto', 'low_fat')),
  measurement_units text not null default 'metric' check (measurement_units in ('metric', 'imperial')),

  -- Meal-planning prefs (collected in a later phase; nullable for now)
  meals_per_day integer not null default 3 check (meals_per_day between 1 and 8),
  suggestion_style text check (suggestion_style in ('recipes', 'ingredients', 'mixed')),
  planning_mode text check (planning_mode in ('self', 'app')),

  -- Optional context
  intermittent_fasting text check (intermittent_fasting in ('never', 'tried', 'current', 'want')),
  hardest text,
  extra_goal text,

  -- Deterministic plan snapshot
  bmr integer,
  tdee integer,
  bmi numeric(4, 1),
  calorie_target integer,
  protein_target integer,
  carbs_target integer,
  fat_target integer,
  weekly_rate_kg numeric(4, 2),
  estimated_weeks integer,

  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

drop policy if exists "user_profiles_select_own" on public.user_profiles;
drop policy if exists "user_profiles_insert_own" on public.user_profiles;
drop policy if exists "user_profiles_update_own" on public.user_profiles;
drop policy if exists "user_profiles_delete_own" on public.user_profiles;

create policy "user_profiles_select_own" on public.user_profiles
  for select to authenticated using (user_id = public.app_user_id());
create policy "user_profiles_insert_own" on public.user_profiles
  for insert to authenticated with check (user_id = public.app_user_id());
create policy "user_profiles_update_own" on public.user_profiles
  for update to authenticated using (user_id = public.app_user_id()) with check (user_id = public.app_user_id());
create policy "user_profiles_delete_own" on public.user_profiles
  for delete to authenticated using (user_id = public.app_user_id());
