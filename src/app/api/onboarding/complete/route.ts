import { NextResponse } from 'next/server';

import { completeOnboardingAction } from '@/features/onboarding/actions';
import { getUser } from '@/lib/auth/get-user';

/**
 * REST entry point for Flutter's onboarding wizard. Wraps
 * `completeOnboardingAction` verbatim: the deterministic body-plan
 * calculation, active goal, food selection and initial meal plan generation
 * all run through the exact same code the web wizard uses. Body validation is
 * `onboardingSchema` (applied inside the action) - not duplicated here.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (err: unknown) {
    console.error('POST /api/onboarding/complete: invalid JSON body', err);
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const result = await completeOnboardingAction(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({ ok: true });
}
