import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { clientEnv } from '@/env.client';

/**
 * Supabase client bound to the current request's cookies. Use from Server
 * Components, Server Actions, and Route Handlers.
 *
 * The `setAll` callback may throw when invoked from a Server Component
 * because Next.js makes the cookie store read-only there. That is expected:
 * the middleware refreshes the session on the next request, so we swallow
 * the throw rather than crash the render.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot mutate cookies; middleware handles it.
          }
        },
      },
    },
  );
}
