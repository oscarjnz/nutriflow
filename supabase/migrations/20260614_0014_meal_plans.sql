-- ─────────────────────────────────────────────────────────────────────────────
-- 0014 - Generated meal plans (Phase 3)
--
-- The deterministic generator (src/lib/nutrition/meal-plan.ts) turns a user's
-- targets + available foods into a concrete day of meals. We persist the result
-- so the exportable record and the daily dashboard read one stable source, and
-- macro figures are snapshotted at generation time (same rule as meal_items):
-- later catalog edits must never rewrite a saved plan.
--
--   meal_plans       - one active plan per user (older ones soft-deleted).
--   meal_plan_items  - the foods in each meal, grouped by `slot`, ordered by
--                      `position`, with frozen macro snapshots.
--
-- Idempotent (safe to paste in Supabase / re-run).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.meal_plans (
  id uuid primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  calorie_target integer not null,
  protein_target integer not null,
  carbs_target integer not null,
  fat_target integer not null,
  meals_per_day integer not null check (meals_per_day between 1 and 8),
  main_meals integer not null check (main_meals between 1 and 8),
  suggestion_style text check (suggestion_style in ('recipes', 'ingredients', 'mixed')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists meal_plans_user_active_idx
  on public.meal_plans (user_id)
  where active and deleted_at is null;

create table if not exists public.meal_plan_items (
  id uuid primary key,
  meal_plan_id uuid not null references public.meal_plans (id) on delete cascade,
  slot integer not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  position integer not null default 0,
  food_id uuid not null references public.foods (id) on delete cascade,
  grams numeric(8, 2) not null,
  calories_snapshot numeric(8, 2) not null,
  protein_snapshot numeric(8, 2) not null,
  carbs_snapshot numeric(8, 2) not null,
  fat_snapshot numeric(8, 2) not null
);

create index if not exists meal_plan_items_plan_idx on public.meal_plan_items (meal_plan_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table public.meal_plans enable row level security;
alter table public.meal_plan_items enable row level security;

drop policy if exists "meal_plans_select_own" on public.meal_plans;
drop policy if exists "meal_plans_insert_own" on public.meal_plans;
drop policy if exists "meal_plans_update_own" on public.meal_plans;
drop policy if exists "meal_plans_delete_own" on public.meal_plans;

create policy "meal_plans_select_own" on public.meal_plans
  for select to authenticated using (user_id = public.app_user_id());
create policy "meal_plans_insert_own" on public.meal_plans
  for insert to authenticated with check (user_id = public.app_user_id());
create policy "meal_plans_update_own" on public.meal_plans
  for update to authenticated using (user_id = public.app_user_id()) with check (user_id = public.app_user_id());
create policy "meal_plans_delete_own" on public.meal_plans
  for delete to authenticated using (user_id = public.app_user_id());

drop policy if exists "meal_plan_items_select_via_plan" on public.meal_plan_items;
drop policy if exists "meal_plan_items_insert_via_plan" on public.meal_plan_items;
drop policy if exists "meal_plan_items_update_via_plan" on public.meal_plan_items;
drop policy if exists "meal_plan_items_delete_via_plan" on public.meal_plan_items;

create policy "meal_plan_items_select_via_plan" on public.meal_plan_items
  for select to authenticated
  using (exists (select 1 from public.meal_plans mp where mp.id = meal_plan_items.meal_plan_id and mp.user_id = public.app_user_id()));
create policy "meal_plan_items_insert_via_plan" on public.meal_plan_items
  for insert to authenticated
  with check (exists (select 1 from public.meal_plans mp where mp.id = meal_plan_items.meal_plan_id and mp.user_id = public.app_user_id()));
create policy "meal_plan_items_update_via_plan" on public.meal_plan_items
  for update to authenticated
  using (exists (select 1 from public.meal_plans mp where mp.id = meal_plan_items.meal_plan_id and mp.user_id = public.app_user_id()))
  with check (exists (select 1 from public.meal_plans mp where mp.id = meal_plan_items.meal_plan_id and mp.user_id = public.app_user_id()));
create policy "meal_plan_items_delete_via_plan" on public.meal_plan_items
  for delete to authenticated
  using (exists (select 1 from public.meal_plans mp where mp.id = meal_plan_items.meal_plan_id and mp.user_id = public.app_user_id()));
