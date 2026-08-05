import { NextResponse } from 'next/server';

import { updateFoodSelectionsAction } from '@/features/onboarding/actions';
import { getUser } from '@/lib/auth/get-user';

/**
 * REST entry point for Flutter's food-selection editor. Wraps
 * `updateFoodSelectionsAction` verbatim (catalog validation, category minimums
 * and active-plan regeneration all run through the same code the web
 * `/foods` editor uses). Body is a bare JSON array of catalog food ids -
 * `["<uuid>", ...]` - matching `foodSelectionsSchema`, which is applied inside
 * the action.
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
    console.error('POST /api/onboarding/food-selections: invalid JSON body', err);
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const result = await updateFoodSelectionsAction(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({ ok: true });
}
