-- ─────────────────────────────────────────────────────────────────────────────
-- 0008 - Row Level Security
--
-- Policy model
-- ────────────
-- Catalog tables (foods, food_aliases, barcodes, food_servings):
--   SELECT  → anyone (anon + authenticated)
--   INSERT/UPDATE/DELETE → no policy → only service_role can mutate.
--
-- User-owned tables (users, user_settings, user_goals, meal_logs, meal_items,
--                    recipes, recipe_items, favorites, fasting_sessions,
--                    weight_logs, user_streaks):
--   Each policy uses auth.uid() = user_id.
--   meal_items and recipe_items cascade their check through the parent row
--   because they have no direct user_id column.
--
-- nlp_cache:
--   No policy → service_role only. Explicit REVOKE adds defense in depth.
--
-- RLS is evaluated under the `authenticated` role set by withUserContext().
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Enable RLS on every table ───────────────────────────────────────────────

alter table public.foods             enable row level security;
alter table public.food_aliases      enable row level security;
alter table public.barcodes          enable row level security;
alter table public.food_servings     enable row level security;
alter table public.nlp_cache         enable row level security;
alter table public.users             enable row level security;
alter table public.user_settings     enable row level security;
alter table public.user_goals        enable row level security;
alter table public.meal_logs         enable row level security;
alter table public.meal_items        enable row level security;
alter table public.recipes           enable row level security;
alter table public.recipe_items      enable row level security;
alter table public.favorites         enable row level security;
alter table public.fasting_sessions  enable row level security;
alter table public.weight_logs       enable row level security;
alter table public.user_streaks      enable row level security;

-- ── Catalog: public read ────────────────────────────────────────────────────

create policy "foods_read_all"          on public.foods          for select to anon, authenticated using (true);
create policy "food_aliases_read_all"   on public.food_aliases   for select to anon, authenticated using (true);
create policy "barcodes_read_all"       on public.barcodes       for select to anon, authenticated using (true);
create policy "food_servings_read_all"  on public.food_servings  for select to anon, authenticated using (true);

-- ── users ───────────────────────────────────────────────────────────────────

create policy "users_select_own" on public.users
  for select to authenticated using (id = auth.uid());

create policy "users_update_own" on public.users
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- INSERT is performed by the SECURITY DEFINER trigger from 0004; no policy
-- needed (and an explicit INSERT policy would let an authenticated user
-- create rogue rows for themselves, which is undesirable since the trigger
-- already does it idempotently).

-- ── user_settings ───────────────────────────────────────────────────────────

create policy "user_settings_select_own" on public.user_settings
  for select to authenticated using (user_id = auth.uid());

create policy "user_settings_insert_own" on public.user_settings
  for insert to authenticated with check (user_id = auth.uid());

create policy "user_settings_update_own" on public.user_settings
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── user_goals ──────────────────────────────────────────────────────────────

create policy "user_goals_select_own" on public.user_goals
  for select to authenticated using (user_id = auth.uid());

create policy "user_goals_insert_own" on public.user_goals
  for insert to authenticated with check (user_id = auth.uid());

create policy "user_goals_update_own" on public.user_goals
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "user_goals_delete_own" on public.user_goals
  for delete to authenticated using (user_id = auth.uid());

-- ── meal_logs ───────────────────────────────────────────────────────────────

create policy "meal_logs_select_own" on public.meal_logs
  for select to authenticated using (user_id = auth.uid());

create policy "meal_logs_insert_own" on public.meal_logs
  for insert to authenticated with check (user_id = auth.uid());

create policy "meal_logs_update_own" on public.meal_logs
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "meal_logs_delete_own" on public.meal_logs
  for delete to authenticated using (user_id = auth.uid());

-- ── meal_items (cascade through parent meal_log) ────────────────────────────

create policy "meal_items_select_via_log" on public.meal_items
  for select to authenticated
  using (exists (
    select 1 from public.meal_logs ml
    where ml.id = meal_items.meal_log_id
      and ml.user_id = auth.uid()
  ));

create policy "meal_items_insert_via_log" on public.meal_items
  for insert to authenticated
  with check (exists (
    select 1 from public.meal_logs ml
    where ml.id = meal_items.meal_log_id
      and ml.user_id = auth.uid()
  ));

create policy "meal_items_update_via_log" on public.meal_items
  for update to authenticated
  using (exists (
    select 1 from public.meal_logs ml
    where ml.id = meal_items.meal_log_id
      and ml.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.meal_logs ml
    where ml.id = meal_items.meal_log_id
      and ml.user_id = auth.uid()
  ));

create policy "meal_items_delete_via_log" on public.meal_items
  for delete to authenticated
  using (exists (
    select 1 from public.meal_logs ml
    where ml.id = meal_items.meal_log_id
      and ml.user_id = auth.uid()
  ));

-- ── recipes ─────────────────────────────────────────────────────────────────

create policy "recipes_select_own" on public.recipes
  for select to authenticated using (user_id = auth.uid());

create policy "recipes_insert_own" on public.recipes
  for insert to authenticated with check (user_id = auth.uid());

create policy "recipes_update_own" on public.recipes
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "recipes_delete_own" on public.recipes
  for delete to authenticated using (user_id = auth.uid());

-- ── recipe_items (cascade through parent recipe) ────────────────────────────

create policy "recipe_items_select_via_recipe" on public.recipe_items
  for select to authenticated
  using (exists (
    select 1 from public.recipes r
    where r.id = recipe_items.recipe_id
      and r.user_id = auth.uid()
  ));

create policy "recipe_items_insert_via_recipe" on public.recipe_items
  for insert to authenticated
  with check (exists (
    select 1 from public.recipes r
    where r.id = recipe_items.recipe_id
      and r.user_id = auth.uid()
  ));

create policy "recipe_items_update_via_recipe" on public.recipe_items
  for update to authenticated
  using (exists (
    select 1 from public.recipes r
    where r.id = recipe_items.recipe_id
      and r.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.recipes r
    where r.id = recipe_items.recipe_id
      and r.user_id = auth.uid()
  ));

create policy "recipe_items_delete_via_recipe" on public.recipe_items
  for delete to authenticated
  using (exists (
    select 1 from public.recipes r
    where r.id = recipe_items.recipe_id
      and r.user_id = auth.uid()
  ));

-- ── favorites ───────────────────────────────────────────────────────────────

create policy "favorites_select_own" on public.favorites
  for select to authenticated using (user_id = auth.uid());

create policy "favorites_insert_own" on public.favorites
  for insert to authenticated with check (user_id = auth.uid());

create policy "favorites_update_own" on public.favorites
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "favorites_delete_own" on public.favorites
  for delete to authenticated using (user_id = auth.uid());

-- ── fasting_sessions ────────────────────────────────────────────────────────

create policy "fasting_select_own" on public.fasting_sessions
  for select to authenticated using (user_id = auth.uid());

create policy "fasting_insert_own" on public.fasting_sessions
  for insert to authenticated with check (user_id = auth.uid());

create policy "fasting_update_own" on public.fasting_sessions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "fasting_delete_own" on public.fasting_sessions
  for delete to authenticated using (user_id = auth.uid());

-- ── weight_logs ─────────────────────────────────────────────────────────────

create policy "weight_logs_select_own" on public.weight_logs
  for select to authenticated using (user_id = auth.uid());

create policy "weight_logs_insert_own" on public.weight_logs
  for insert to authenticated with check (user_id = auth.uid());

create policy "weight_logs_update_own" on public.weight_logs
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "weight_logs_delete_own" on public.weight_logs
  for delete to authenticated using (user_id = auth.uid());

-- ── user_streaks ────────────────────────────────────────────────────────────

create policy "streaks_select_own" on public.user_streaks
  for select to authenticated using (user_id = auth.uid());

create policy "streaks_insert_own" on public.user_streaks
  for insert to authenticated with check (user_id = auth.uid());

create policy "streaks_update_own" on public.user_streaks
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "streaks_delete_own" on public.user_streaks
  for delete to authenticated using (user_id = auth.uid());

-- ── nlp_cache: service_role only ────────────────────────────────────────────

revoke all on public.nlp_cache from anon, authenticated;
grant  all on public.nlp_cache to   service_role;
