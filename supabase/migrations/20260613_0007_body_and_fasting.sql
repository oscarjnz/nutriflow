-- ─────────────────────────────────────────────────────────────────────────────
-- 0007 - fasting_sessions, weight_logs, user_streaks
--
-- `fasting_sessions`: end_at null means the session is in progress. The
-- partial unique index enforces at-most-one active session per user, which
-- guarantees the timer UI never has to reconcile multiple open fasts.
--
-- `weight_logs`: composition columns (body_fat_pct, waist_cm, neck_cm,
-- hips_cm) are optional so a user can log just bodyweight, while still
-- having the columns ready for navy-method body-fat estimation in a later
-- sprint.
--
-- `user_streaks`: composite PK (user_id, streak_type) keeps logging and
-- fasting streaks independent without an extra `id` column.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.fasting_sessions (
  id              uuid primary key,
  user_id         uuid not null references public.users(id) on delete cascade,
  start_at        timestamptz not null,
  end_at          timestamptz,
  target_hours    integer not null check (target_hours > 0 and target_hours <= 72),
  protocol        text not null check (protocol in ('12:12', '14:10', '16:8', '18:6', '20:4', 'custom')),
  notes           text,
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  check (end_at is null or end_at > start_at)
);

create index fasting_user_start_idx
  on public.fasting_sessions (user_id, start_at desc)
  where deleted_at is null;

create unique index fasting_active_per_user
  on public.fasting_sessions (user_id)
  where end_at is null and deleted_at is null;


create table public.weight_logs (
  id              uuid primary key,
  user_id         uuid not null references public.users(id) on delete cascade,
  weight_kg       numeric(5, 2) not null check (weight_kg > 0 and weight_kg < 500),
  body_fat_pct    numeric(4, 2)          check (body_fat_pct >= 0 and body_fat_pct <= 100),
  waist_cm        numeric(5, 2)          check (waist_cm > 0),
  neck_cm         numeric(5, 2)          check (neck_cm  > 0),
  hips_cm         numeric(5, 2)          check (hips_cm  > 0),
  logged_at       timestamptz not null,
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index weight_logs_user_logged_idx
  on public.weight_logs (user_id, logged_at desc)
  where deleted_at is null;


create table public.user_streaks (
  user_id             uuid not null references public.users(id) on delete cascade,
  streak_type         text not null check (streak_type in ('logging', 'fasting')),
  current_count       integer not null default 0 check (current_count >= 0),
  longest_count       integer not null default 0 check (longest_count >= 0),
  last_logged_date    date,
  updated_at          timestamptz not null default now(),
  primary key (user_id, streak_type)
);

create trigger user_streaks_set_updated_at
  before update on public.user_streaks
  for each row execute function public.set_updated_at();
