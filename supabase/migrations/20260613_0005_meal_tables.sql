-- ─────────────────────────────────────────────────────────────────────────────
-- 0005 - Meal logging: meal_logs, meal_items
--
-- `meal_items` stores *snapshots* of macros (calories_snapshot, …) computed
-- at log time in the application layer (`src/lib/nutrition/`). Future edits
-- to `foods` (correcting a nutritional value) never retroactively alter a
-- user's history.
--
-- `meal_items.quantity_grams` is denormalized from (quantity, unit) using
-- `food_servings`. Storing the resolved grams lets aggregation queries
-- ("calories per day") avoid joining `food_servings` on every read.
--
-- `meal_logs.synced` defaults true. The offline mutation queue introduced in
-- Sprint 6 will insert with synced=false and flip it to true once accepted
-- by the server.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.meal_logs (
  id              uuid primary key,
  user_id         uuid not null references public.users(id) on delete cascade,
  logged_at       timestamptz not null,
  meal_type       text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  notes           text,
  synced          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index meal_logs_user_logged_idx
  on public.meal_logs (user_id, logged_at desc)
  where deleted_at is null;

create trigger meal_logs_set_updated_at
  before update on public.meal_logs
  for each row execute function public.set_updated_at();


create table public.meal_items (
  id                      uuid primary key,
  meal_log_id             uuid not null references public.meal_logs(id) on delete cascade,
  food_id                 uuid not null references public.foods(id) on delete restrict,
  quantity                numeric(8, 2) not null check (quantity > 0),
  unit                    text not null,
  quantity_grams          numeric(8, 2) not null check (quantity_grams > 0),
  source                  text not null check (source in ('manual', 'nlp', 'barcode', 'recipe', 'favorite')),
  calories_snapshot       numeric(8, 2) not null check (calories_snapshot >= 0),
  protein_snapshot        numeric(8, 2) not null check (protein_snapshot  >= 0),
  carbs_snapshot          numeric(8, 2) not null check (carbs_snapshot    >= 0),
  fat_snapshot            numeric(8, 2) not null check (fat_snapshot      >= 0),
  created_at              timestamptz not null default now(),
  deleted_at              timestamptz
);

create index meal_items_meal_log_idx on public.meal_items (meal_log_id);
create index meal_items_food_idx on public.meal_items (food_id);
