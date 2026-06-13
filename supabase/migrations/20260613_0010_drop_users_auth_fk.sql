-- ─────────────────────────────────────────────────────────────────────────────
-- 0010 — Detach public.users from auth.users
--
-- With Clerk as the identity provider, rows in auth.users are never created,
-- so the original `users_id_fkey` (id references auth.users(id)) blocks every
-- profile insert. public.users.id is now an app-managed UUID v7, mapped to the
-- Clerk subject via the clerk_id column added in 0009.
--
-- clerk_id is left nullable here on purpose: a NOT NULL constraint would
-- require deleting pre-existing test rows, which is a destructive operation we
-- defer. The application always sets clerk_id on insert, so new rows are never
-- null. A follow-up migration can enforce NOT NULL after legacy rows are
-- cleaned up with explicit sign-off.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;
