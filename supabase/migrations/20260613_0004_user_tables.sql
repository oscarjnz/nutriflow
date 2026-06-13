-- ─────────────────────────────────────────────────────────────────────────────
-- 0004 — User profile, settings, goals
--
-- `public.users` mirrors `auth.users` 1:1 via a SECURITY DEFINER trigger
-- (`handle_new_auth_user`) attached to `auth.users` AFTER INSERT. The trigger
-- also creates a default `user_settings` row so the application never has to
-- handle a "settings missing" branch.
--
-- The trigger runs as the function owner (postgres / supabase_admin), which
-- means it can write into `public.users` and `public.user_settings` even
-- though the inserting user has not yet acquired a session. `search_path`
-- is pinned to `public` to defeat search-path injection attacks against
-- security-definer functions.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.users (
  id              uuid primary key references auth.users(id) on delete cascade,
  display_name    text,
  locale          text not null default 'es',
  units           text not null default 'metric' check (units in ('metric', 'imperial')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();


create table public.user_settings (
  user_id                       uuid primary key references public.users(id) on delete cascade,
  theme                         text not null default 'system' check (theme in ('system', 'light', 'dark')),
  reminders_enabled             boolean not null default true,
  privacy_share_anon_aliases    boolean not null default false,
  updated_at                    timestamptz not null default now()
);

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();


-- Auth → profile sync. Runs in the auth schema's hook chain.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email)
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();


create table public.user_goals (
  id                  uuid primary key,
  user_id             uuid not null references public.users(id) on delete cascade,
  calorie_target      integer not null check (calorie_target > 0),
  protein_target      integer not null check (protein_target >= 0),
  carbs_target        integer not null check (carbs_target   >= 0),
  fat_target          integer not null check (fat_target     >= 0),
  weight_target_kg    numeric(5, 2) check (weight_target_kg > 0),
  active              boolean not null default true,
  starts_on           date not null,
  ends_on             date,
  created_at          timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

create index user_goals_user_active_idx on public.user_goals (user_id) where active = true;
