-- Clerk replaces Supabase Auth as the identity provider.
-- We keep users.id as internal UUID (PK, used for FK chains and RLS)
-- and store the Clerk user ID separately for lookups at the auth boundary.
-- The trigger handle_new_auth_user is dropped because user creation is now
-- handled explicitly in src/lib/auth/get-user.ts via the admin client.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS clerk_id TEXT,
  ADD CONSTRAINT users_clerk_id_unique UNIQUE (clerk_id);

-- Drop the Supabase Auth trigger — Clerk does not fire auth.users inserts.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_auth_user();
