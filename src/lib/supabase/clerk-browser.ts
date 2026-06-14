'use client';

import { useSession } from '@clerk/nextjs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { useMemo } from 'react';

import { clientEnv } from '@/env.client';

/**
 * Browser-side Supabase client authenticated with the current Clerk session -
 * the "just query Supabase directly" path (S.H.S style).
 *
 * `accessToken` is called by supabase-js before each request; it returns the
 * Clerk session token, which Supabase accepts once Clerk is registered as a
 * Third-Party Auth provider (see README → "Clerk ↔ Supabase"). RLS then runs
 * under the `authenticated` role and `app_user_id()` resolves the row owner
 * from the token's `sub` (the Clerk user id), so the browser only ever sees
 * its own rows - no service-role key, no server round-trip for simple CRUD.
 *
 * Use for user-owned reads/writes from Client Components. Secrets (Groq, seed,
 * service-role work) stay on the server.
 */
export function useSupabaseBrowser(): SupabaseClient {
  const { session } = useSession();

  return useMemo(
    () =>
      createClient(
        clientEnv.NEXT_PUBLIC_SUPABASE_URL,
        clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          accessToken: async () => (await session?.getToken()) ?? null,
        },
      ),
    [session],
  );
}
