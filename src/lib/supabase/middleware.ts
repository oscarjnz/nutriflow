import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

import { clientEnv } from '@/env.client';

/**
 * Refresh the Supabase session on every request and return the current user.
 *
 * `supabase.auth.getUser()` revalidates the access token against the auth
 * server, which is what triggers a refresh-token rotation when the access
 * token is near expiry. Calling it inside middleware on every request keeps
 * cookies fresh without burdening individual route handlers.
 *
 * The dance with `request.cookies.set` followed by `NextResponse.next(...)`
 * is required by Next 15: cookies set on the incoming request are visible
 * to downstream RSCs, while the same cookies on the response are sent to
 * the browser.
 */
export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
