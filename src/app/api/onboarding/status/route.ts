import { NextResponse } from 'next/server';

import { getUser } from '@/lib/auth/get-user';
import { hasCompletedOnboarding } from '@/repositories/user-profile.repo';

/**
 * REST entry point for Flutter's auth gate: whether the signed-in user has
 * a completed onboarding profile, so the app can route to the onboarding
 * wizard (`POST /api/onboarding/complete`) or straight to the dashboard.
 * Mirrors the check `src/app/onboarding/page.tsx` does server-side on web
 * (`profile?.onboardingCompleted`).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const completed = await hasCompletedOnboarding(user.id);
  return NextResponse.json({ completed });
}
