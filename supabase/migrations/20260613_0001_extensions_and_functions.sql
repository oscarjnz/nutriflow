-- ─────────────────────────────────────────────────────────────────────────────
-- 0001 - Extensions and shared functions
--
-- Why pgcrypto: gen_random_uuid() fallback in case any default uses it (UUID
-- v7s are generated in the application layer with the `uuid` npm package, but
-- pgcrypto is cheap and harmless to enable).
-- Why pg_trgm:  trigram GIN index on `food_aliases.alias_text` for fuzzy
-- matching of free-text food names against aliases.
-- Why unaccent: tsvector built on Spanish food names needs accent-insensitive
-- search ("platano" must match "plátano"). We wrap unaccent() in an
-- IMMUTABLE wrapper so it can be used inside a GENERATED column on `foods`.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- Immutable wrapper around unaccent(). The unaccent() function is technically
-- STABLE because its dictionary is loaded at session time, so it cannot be
-- used inside GENERATED columns. Pinning the dictionary at call time makes
-- the result deterministic and lets us mark the wrapper IMMUTABLE.
create or replace function public.f_unaccent(text)
returns text
language sql
immutable
strict
parallel safe
as $$
  select public.unaccent('public.unaccent'::regdictionary, $1);
$$;

-- Generic updated_at trigger function. Attached per-table by later migrations.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
