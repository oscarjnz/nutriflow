import { createBrowserClient } from '@supabase/ssr';

import { clientEnv } from '@/env.client';

/**
 * Singleton Supabase client for the browser. Use from Client Components.
 * Reads/writes session cookies via `@supabase/ssr` so the server-side client
 * sees the same session.
 */
let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (browserClient) return browserClient;
  browserClient = createBrowserClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return browserClient;
}
