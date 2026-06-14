-- ─────────────────────────────────────────────────────────────────────────────
-- 0011 - RLS keyed on the Clerk subject
--
-- Why: with Clerk as the identity provider, the JWT `sub` claim is the Clerk
-- user id ("user_xxx"), not our internal UUID - so auth.uid() (which casts sub
-- to uuid) can't be used. `app_user_id()` resolves the internal UUID from the
-- Clerk sub via the clerk_id mapping. This single function works for BOTH:
--   * the browser querying Supabase directly with a Clerk third-party token, and
--   * server code via withUserContext (which now injects sub = clerk_id).
--
-- SECURITY DEFINER + pinned search_path lets the helper read public.users
-- without recursing into the users RLS policy.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.users
  where clerk_id = nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
$$;

revoke all on function public.app_user_id() from public;
grant execute on function public.app_user_id() to anon, authenticated, service_role;

-- ── Rewrite every user-owned policy from auth.uid() to app_user_id() ─────────

-- users
drop policy if exists "users_select_own" on public.users;
drop policy if exists "users_update_own" on public.users;
create policy "users_select_own" on public.users
  for select to authenticated using (id = public.app_user_id());
create policy "users_update_own" on public.users
  for update to authenticated using (id = public.app_user_id()) with check (id = public.app_user_id());

-- user_settings
drop policy if exists "user_settings_select_own" on public.user_settings;
drop policy if exists "user_settings_insert_own" on public.user_settings;
drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_select_own" on public.user_settings
  for select to authenticated using (user_id = public.app_user_id());
create policy "user_settings_insert_own" on public.user_settings
  for insert to authenticated with check (user_id = public.app_user_id());
create policy "user_settings_update_own" on public.user_settings
  for update to authenticated using (user_id = public.app_user_id()) with check (user_id = public.app_user_id());

-- user_goals
drop policy if exists "user_goals_select_own" on public.user_goals;
drop policy if exists "user_goals_insert_own" on public.user_goals;
drop policy if exists "user_goals_update_own" on public.user_goals;
drop policy if exists "user_goals_delete_own" on public.user_goals;
create policy "user_goals_select_own" on public.user_goals
  for select to authenticated using (user_id = public.app_user_id());
create policy "user_goals_insert_own" on public.user_goals
  for insert to authenticated with check (user_id = public.app_user_id());
create policy "user_goals_update_own" on public.user_goals
  for update to authenticated using (user_id = public.app_user_id()) with check (user_id = public.app_user_id());
create policy "user_goals_delete_own" on public.user_goals
  for delete to authenticated using (user_id = public.app_user_id());

-- meal_logs
drop policy if exists "meal_logs_select_own" on public.meal_logs;
drop policy if exists "meal_logs_insert_own" on public.meal_logs;
drop policy if exists "meal_logs_update_own" on public.meal_logs;
drop policy if exists "meal_logs_delete_own" on public.meal_logs;
create policy "meal_logs_select_own" on public.meal_logs
  for select to authenticated using (user_id = public.app_user_id());
create policy "meal_logs_insert_own" on public.meal_logs
  for insert to authenticated with check (user_id = public.app_user_id());
create policy "meal_logs_update_own" on public.meal_logs
  for update to authenticated using (user_id = public.app_user_id()) with check (user_id = public.app_user_id());
create policy "meal_logs_delete_own" on public.meal_logs
  for delete to authenticated using (user_id = public.app_user_id());

-- meal_items (cascade through parent meal_log)
drop policy if exists "meal_items_select_via_log" on public.meal_items;
drop policy if exists "meal_items_insert_via_log" on public.meal_items;
drop policy if exists "meal_items_update_via_log" on public.meal_items;
drop policy if exists "meal_items_delete_via_log" on public.meal_items;
create policy "meal_items_select_via_log" on public.meal_items
  for select to authenticated
  using (exists (select 1 from public.meal_logs ml where ml.id = meal_items.meal_log_id and ml.user_id = public.app_user_id()));
create policy "meal_items_insert_via_log" on public.meal_items
  for insert to authenticated
  with check (exists (select 1 from public.meal_logs ml where ml.id = meal_items.meal_log_id and ml.user_id = public.app_user_id()));
create policy "meal_items_update_via_log" on public.meal_items
  for update to authenticated
  using (exists (select 1 from public.meal_logs ml where ml.id = meal_items.meal_log_id and ml.user_id = public.app_user_id()))
  with check (exists (select 1 from public.meal_logs ml where ml.id = meal_items.meal_log_id and ml.user_id = public.app_user_id()));
create policy "meal_items_delete_via_log" on public.meal_items
  for delete to authenticated
  using (exists (select 1 from public.meal_logs ml where ml.id = meal_items.meal_log_id and ml.user_id = public.app_user_id()));

-- recipes
drop policy if exists "recipes_select_own" on public.recipes;
drop policy if exists "recipes_insert_own" on public.recipes;
drop policy if exists "recipes_update_own" on public.recipes;
drop policy if exists "recipes_delete_own" on public.recipes;
create policy "recipes_select_own" on public.recipes
  for select to authenticated using (user_id = public.app_user_id());
create policy "recipes_insert_own" on public.recipes
  for insert to authenticated with check (user_id = public.app_user_id());
create policy "recipes_update_own" on public.recipes
  for update to authenticated using (user_id = public.app_user_id()) with check (user_id = public.app_user_id());
create policy "recipes_delete_own" on public.recipes
  for delete to authenticated using (user_id = public.app_user_id());

-- recipe_items (cascade through parent recipe)
drop policy if exists "recipe_items_select_via_recipe" on public.recipe_items;
drop policy if exists "recipe_items_insert_via_recipe" on public.recipe_items;
drop policy if exists "recipe_items_update_via_recipe" on public.recipe_items;
drop policy if exists "recipe_items_delete_via_recipe" on public.recipe_items;
create policy "recipe_items_select_via_recipe" on public.recipe_items
  for select to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_items.recipe_id and r.user_id = public.app_user_id()));
create policy "recipe_items_insert_via_recipe" on public.recipe_items
  for insert to authenticated
  with check (exists (select 1 from public.recipes r where r.id = recipe_items.recipe_id and r.user_id = public.app_user_id()));
create policy "recipe_items_update_via_recipe" on public.recipe_items
  for update to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_items.recipe_id and r.user_id = public.app_user_id()))
  with check (exists (select 1 from public.recipes r where r.id = recipe_items.recipe_id and r.user_id = public.app_user_id()));
create policy "recipe_items_delete_via_recipe" on public.recipe_items
  for delete to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_items.recipe_id and r.user_id = public.app_user_id()));

-- favorites
drop policy if exists "favorites_select_own" on public.favorites;
drop policy if exists "favorites_insert_own" on public.favorites;
drop policy if exists "favorites_update_own" on public.favorites;
drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_select_own" on public.favorites
  for select to authenticated using (user_id = public.app_user_id());
create policy "favorites_insert_own" on public.favorites
  for insert to authenticated with check (user_id = public.app_user_id());
create policy "favorites_update_own" on public.favorites
  for update to authenticated using (user_id = public.app_user_id()) with check (user_id = public.app_user_id());
create policy "favorites_delete_own" on public.favorites
  for delete to authenticated using (user_id = public.app_user_id());

-- fasting_sessions
drop policy if exists "fasting_select_own" on public.fasting_sessions;
drop policy if exists "fasting_insert_own" on public.fasting_sessions;
drop policy if exists "fasting_update_own" on public.fasting_sessions;
drop policy if exists "fasting_delete_own" on public.fasting_sessions;
create policy "fasting_select_own" on public.fasting_sessions
  for select to authenticated using (user_id = public.app_user_id());
create policy "fasting_insert_own" on public.fasting_sessions
  for insert to authenticated with check (user_id = public.app_user_id());
create policy "fasting_update_own" on public.fasting_sessions
  for update to authenticated using (user_id = public.app_user_id()) with check (user_id = public.app_user_id());
create policy "fasting_delete_own" on public.fasting_sessions
  for delete to authenticated using (user_id = public.app_user_id());

-- weight_logs
drop policy if exists "weight_logs_select_own" on public.weight_logs;
drop policy if exists "weight_logs_insert_own" on public.weight_logs;
drop policy if exists "weight_logs_update_own" on public.weight_logs;
drop policy if exists "weight_logs_delete_own" on public.weight_logs;
create policy "weight_logs_select_own" on public.weight_logs
  for select to authenticated using (user_id = public.app_user_id());
create policy "weight_logs_insert_own" on public.weight_logs
  for insert to authenticated with check (user_id = public.app_user_id());
create policy "weight_logs_update_own" on public.weight_logs
  for update to authenticated using (user_id = public.app_user_id()) with check (user_id = public.app_user_id());
create policy "weight_logs_delete_own" on public.weight_logs
  for delete to authenticated using (user_id = public.app_user_id());

-- user_streaks
drop policy if exists "streaks_select_own" on public.user_streaks;
drop policy if exists "streaks_insert_own" on public.user_streaks;
drop policy if exists "streaks_update_own" on public.user_streaks;
drop policy if exists "streaks_delete_own" on public.user_streaks;
create policy "streaks_select_own" on public.user_streaks
  for select to authenticated using (user_id = public.app_user_id());
create policy "streaks_insert_own" on public.user_streaks
  for insert to authenticated with check (user_id = public.app_user_id());
create policy "streaks_update_own" on public.user_streaks
  for update to authenticated using (user_id = public.app_user_id()) with check (user_id = public.app_user_id());
create policy "streaks_delete_own" on public.user_streaks
  for delete to authenticated using (user_id = public.app_user_id());
