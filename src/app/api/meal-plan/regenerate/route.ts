import { NextResponse } from 'next/server';

import { regeneratePlanAction } from '@/features/meal-plan/actions';
import { getUser } from '@/lib/auth/get-user';

/**
 * REST entry point for Flutter (Fase 1, CLAUDE.md §6/§8). Wraps the exact same
 * `regeneratePlanAction` the web dashboard calls - one source of truth, two
 * entry points. Requires a valid Clerk session (cookie or `Authorization:
 * Bearer <token>`); `clerkMiddleware` already gates `/api/*`, but we re-check
 * here so this endpoint never silently serves an anonymous caller and always
 * returns JSON (never a redirect) on auth failure.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(): Promise<NextResponse> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await regeneratePlanAction();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({ ok: true });
}
