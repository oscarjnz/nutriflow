import { NextResponse } from 'next/server';

import { getUser } from '@/lib/auth/get-user';
import { listSelectableFoods } from '@/repositories/user-food-selections.repo';

/**
 * REST entry point for the onboarding wizard's "available foods" step
 * (`src/features/onboarding/food-selection.ts` on web). Category minimums
 * (`CATEGORY_META`) are static and duplicated client-side in mobile rather
 * than served here - the server re-validates the submitted selection
 * authoritatively in `completeOnboardingAction` regardless.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const foods = await listSelectableFoods();
  return NextResponse.json({ foods });
}
