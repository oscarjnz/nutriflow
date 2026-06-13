import 'server-only';

import type { User } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

/**
 * Return the verified user for the current request, or `null` if there is no
 * session. Always uses `getUser()` (server-verified), never `getSession()`
 * (cookie-only, untrusted).
 */
export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Return the verified user or redirect to `/login`. Use in Server Components
 * and Server Actions where authentication is required as a hard precondition.
 */
export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) {
    redirect('/login');
  }
  return user;
}
