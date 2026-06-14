-- ─────────────────────────────────────────────────────────────────────────────
-- 0006 - recipes, recipe_items, favorites
--
-- Recipes are user-owned compositions ("post-workout shake"). At log time the
-- application flattens a recipe into N meal_items using the same snapshot
-- pattern as 0005.
--
-- `favorites` is a single 1-tap entry pointing to either a food or a recipe
-- (the CHECK enforces exactly one target). `position` orders the user's
-- favorites strip on the dashboard; no UNIQUE on (user_id, position) so the
-- application can reorder without locking - the order is reconciled at write
-- time by client code.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.recipes (
  id              uuid primary key,
  user_id         uuid not null references public.users(id) on delete cascade,
  name            text not null,
  servings        integer not null default 1 check (servings > 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index recipes_user_idx on public.recipes (user_id) where deleted_at is null;

create trigger recipes_set_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();


create table public.recipe_items (
  id              uuid primary key,
  recipe_id       uuid not null references public.recipes(id) on delete cascade,
  food_id         uuid not null references public.foods(id) on delete restrict,
  quantity        numeric(8, 2) not null check (quantity > 0),
  unit            text not null
);

create index recipe_items_recipe_idx on public.recipe_items (recipe_id);


create table public.favorites (
  id              uuid primary key,
  user_id         uuid not null references public.users(id) on delete cascade,
  food_id         uuid references public.foods(id)   on delete cascade,
  recipe_id       uuid references public.recipes(id) on delete cascade,
  label           text not null,
  position        integer not null default 0,
  created_at      timestamptz not null default now(),
  check (num_nonnulls(food_id, recipe_id) = 1)
);

create index favorites_user_position_idx on public.favorites (user_id, position);
