import { NextResponse } from 'next/server';

import { logMealAction } from '@/features/logging/actions';
import { getUser } from '@/lib/auth/get-user';

/**
 * REST entry point for Flutter's manual logging screen. Wraps `logMealAction`
 * verbatim - body validation (`quickLogSchema`) and macro-snapshot computation
 * (`prepareMealItem`/`computeMacros`) happen there, not here, so mobile never
 * needs its own copy of that math (CLAUDE.md §2).
 *
 * Body: `{ foodId: uuid, grams: number, mealType: 'breakfast'|'lunch'|'dinner'|'snack',
 * source?: 'manual'|'nlp'|'barcode'|'recipe'|'favorite' }`. `source` defaults
 * to 'manual'; the mobile NLP-driven flow (POST /api/nlp/parse -> user picks a
 * candidate) should pass `'nlp'`.
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
    console.error('POST /api/logging/log-meal: invalid JSON body', err);
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const result = await logMealAction(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({ ok: true });
}
