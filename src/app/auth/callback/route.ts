import { type NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

/**
 * OAuth + magic link callback. Supabase redirects the browser here with a
 * `code` query parameter; we exchange it for a session (which writes the
 * auth cookies via the server client) and then continue to `next` or `/`.
 *
 * If anything fails, redirect to `/auth/error` with a reason so the user
 * gets a real message instead of a blank page.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next');
  const next = nextParam && nextParam.startsWith('/') ? nextParam : '/';

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/error?reason=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('exchangeCodeForSession', error);
    return NextResponse.redirect(`${origin}/auth/error?reason=exchange_failed`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
