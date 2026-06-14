-- ─────────────────────────────────────────────────────────────────────────────
-- 0013 - Food categories + meal-planning prefs + user food selections (Phase 2)
--
-- Three additive changes that power the onboarding "editable plan" + "available
-- food selection by category" step:
--
--   1. foods.category - a coarse taxonomy so the picker can group staples and
--      the meal generator (Phase 3) can balance a plate. Defaults to 'other';
--      the curated USDA/OFF seed rows are backfilled by their deterministic ids.
--   2. user_profiles.main_meals - how many of meals_per_day are main meals
--      (the rest are snacks). meals_per_day / suggestion_style already exist.
--   3. user_food_selections - the set of foods a user marks as available.
--      Set-membership table (PK = user_id + food_id), RLS-owned by the user.
--
-- Idempotent (safe to paste in Supabase / re-run).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. foods.category ────────────────────────────────────────────────────────

alter table public.foods
  add column if not exists category text not null default 'other'
    check (category in ('grain', 'legume', 'protein', 'dairy', 'vegetable', 'fruit', 'fat', 'other'));

create index if not exists foods_category_idx on public.foods (category);

-- Backfill the curated catalog by deterministic uuidv5 id (namespace + key match
-- scripts/seed-foods.ts). Bulk-imported OFF products stay 'other'. Re-running
-- `pnpm db:seed` keeps these in sync going forward (it now writes category too).
update public.foods set category = 'grain' where id in ('dfd583cc-99f4-50c5-8d12-d47599a8fc9c', '10eb212a-46a7-57d1-a97b-096c43053e7b', 'd211083e-2613-578a-b5eb-4fe44b0bddd5', '5b839fba-876d-5c38-aebe-6c9815d4700a', 'c17b42f6-da6a-56dc-9d43-0a7b33210719', '32f77868-bdf0-5dfa-b7a2-d08bac48d7c1', 'ff2cd387-f1c3-5ebe-9c73-5af34f32d3d7', 'b7ceeb4f-d993-512e-889d-1a5d30b33f69', 'cb9a255c-8394-53bf-ab6c-d74c7fb3354d', '26d94f29-843a-581f-a394-c4e68c5db8c8', 'f85bfc0d-89a7-52fd-8490-96dda6166d43');
update public.foods set category = 'legume' where id in ('8b82c070-0bac-5678-8e40-9af67f83c702', 'd9c08f06-d085-5081-bd95-d2d9ba1dff13', 'f0c58429-8329-565f-9153-7c0919e6274e', '0d190235-6e16-5f7e-a0f4-baea880ad4cc');
update public.foods set category = 'protein' where id in ('5f9a6b69-02ff-5459-b4e2-e4ffdb36ea1e', '9b0a27bc-f73e-5507-8a88-32e47773ffa6', '148c4093-c0fd-591d-9c79-492cb1c3b619', '6ce0701d-70be-50ce-976c-615a11b06a7a', '9597cfaf-c321-51a9-81e6-561de748341f', '0be7246c-6d83-588b-b883-4837e7a5f9a8', 'd10d8e73-dba9-5cc8-952c-be09c2c4a67a', '14c8f528-9539-5e2e-b569-9998e936f457');
update public.foods set category = 'dairy' where id in ('ce7818cd-19bc-5593-9601-b9655ffc624f', '846b819d-dc2c-50d7-854a-54e1f4e9e259', '7eac2eb9-0e96-55a1-a229-84b9c3608c56');
update public.foods set category = 'fat' where id in ('dc330566-01c5-5b11-897a-60e2e782fe9e', '5eb13ffa-95e0-5627-8156-047b859e59bf', 'ad21e5b4-f324-5a7e-bf53-ca7de39bf615', '9680282c-48e6-5143-a6c2-cb8f9617c72c', '85c9ec1b-d048-5751-8046-7ed3068bc273');
update public.foods set category = 'vegetable' where id in ('3ba0a9fc-e25f-5941-963d-94bd11ff944d', '4d5eed5e-48a5-558d-8b51-0d51a989295d', '9aa55bad-5a5a-591f-94c6-c0e6fbecd471', 'bbf57db6-0581-5fe1-8a30-ed9ca8746a55', '8ba4b31a-4be5-5c7b-a7d3-205117da31a5', '63f9ff8e-6c25-5abd-9db3-b0d175a4fd10', '2fd1d5cf-ab39-5ede-aacd-736e9f753958');
update public.foods set category = 'fruit' where id in ('8ff8422e-aee2-51c9-adb4-429465da7768', 'aecab979-c59a-5ab7-9cf3-f5782e653c61', 'd8209357-6f3a-5121-b65c-d8c45fa6a5e5', '46ec5cea-b792-5dc3-acb0-2c6b29129c37', '10e24b97-6ea0-5259-9d2d-7bdf8ce31b45', '240ab317-af34-503f-a8e8-9f7b56416362');
update public.foods set category = 'other' where id in ('66535c22-bff5-5072-90ab-2ea3cf20f27b', 'c5112dc6-d3fa-5853-becf-f0215de63df3', 'dad52c02-b8df-5c3b-a55f-fc0a22a7d641');

-- ── 2. user_profiles.main_meals ──────────────────────────────────────────────

alter table public.user_profiles
  add column if not exists main_meals integer not null default 3
    check (main_meals between 1 and 8);

-- ── 3. user_food_selections ──────────────────────────────────────────────────

create table if not exists public.user_food_selections (
  user_id uuid not null references public.users (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, food_id)
);

create index if not exists user_food_selections_user_idx on public.user_food_selections (user_id);

alter table public.user_food_selections enable row level security;

drop policy if exists "user_food_selections_select_own" on public.user_food_selections;
drop policy if exists "user_food_selections_insert_own" on public.user_food_selections;
drop policy if exists "user_food_selections_delete_own" on public.user_food_selections;

create policy "user_food_selections_select_own" on public.user_food_selections
  for select to authenticated using (user_id = public.app_user_id());
create policy "user_food_selections_insert_own" on public.user_food_selections
  for insert to authenticated with check (user_id = public.app_user_id());
create policy "user_food_selections_delete_own" on public.user_food_selections
  for delete to authenticated using (user_id = public.app_user_id());
