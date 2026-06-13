-- ─────────────────────────────────────────────────────────────────────────────
-- 0002 — Catalog: foods, food_aliases, barcodes, food_servings
--
-- These four tables hold the global nutritional catalog. Reads are public;
-- writes are restricted to service_role (enforced in 0008_rls.sql).
--
-- foods.search_vector is GENERATED ALWAYS from name_es + name_en, lowered and
-- unaccented via the f_unaccent() wrapper from 0001. Index is GIN.
--
-- food_aliases enables the LLM extraction layer: every food has 1..N free-text
-- aliases the user might say ("huevos", "huevo cocido", "egg"). A trigram GIN
-- index supports fast similarity lookups; the unique(food_id, alias_text,
-- locale) constraint guarantees the seed is idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.foods (
  id              uuid primary key,
  name_en         text not null,
  name_es         text not null,
  source          text not null check (source in ('usda', 'off', 'manual')),
  fdc_id          integer,
  barcode         text,
  calories        numeric(8, 2) not null check (calories >= 0),
  protein         numeric(8, 2) not null check (protein  >= 0),
  carbs           numeric(8, 2) not null check (carbs    >= 0),
  fat             numeric(8, 2) not null check (fat      >= 0),
  fiber           numeric(8, 2)          check (fiber    >= 0),
  sugar           numeric(8, 2)          check (sugar    >= 0),
  sodium          numeric(8, 2)          check (sodium   >= 0),
  serving_size    numeric(8, 2) not null check (serving_size > 0),
  serving_unit    text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  search_vector   tsvector generated always as (
    to_tsvector(
      'simple',
      public.f_unaccent(coalesce(name_es, '') || ' ' || coalesce(name_en, ''))
    )
  ) stored
);

create index foods_search_vector_idx on public.foods using gin (search_vector);
create unique index foods_fdc_id_uniq on public.foods (fdc_id) where fdc_id is not null;
create index foods_barcode_idx on public.foods (barcode) where barcode is not null;

create trigger foods_set_updated_at
  before update on public.foods
  for each row execute function public.set_updated_at();


create table public.food_aliases (
  id              uuid primary key,
  food_id         uuid not null references public.foods(id) on delete cascade,
  alias_text      text not null,
  locale          text not null default 'es',
  confidence      numeric(3, 2) not null default 1.00 check (confidence between 0 and 1),
  created_at      timestamptz not null default now(),
  unique (food_id, alias_text, locale)
);

create index food_aliases_alias_trgm_idx on public.food_aliases using gin (alias_text gin_trgm_ops);
create index food_aliases_food_id_idx on public.food_aliases (food_id);


create table public.barcodes (
  id              uuid primary key,
  food_id         uuid not null references public.foods(id) on delete cascade,
  barcode         text not null unique,
  source          text not null check (source in ('usda', 'off', 'manual')),
  created_at      timestamptz not null default now()
);

create index barcodes_food_id_idx on public.barcodes (food_id);


create table public.food_servings (
  id              uuid primary key,
  food_id         uuid not null references public.foods(id) on delete cascade,
  label           text not null,
  grams           numeric(8, 2) not null check (grams > 0),
  is_default      boolean not null default false,
  unique (food_id, label)
);

create index food_servings_food_id_idx on public.food_servings (food_id);
