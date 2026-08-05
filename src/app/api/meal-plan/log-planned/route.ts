import { NextResponse } from 'next/server';
import { z } from 'zod';

import { logPlannedMealAction } from '@/features/meal-plan/actions';
import { getUser } from '@/lib/auth/get-user';

/**
 * REST entry point for Flutter. Wraps `logPlannedMealAction` (same code path
 * the web "one tap" plan logging button uses). Body: `{ "slot": number }`.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  slot: z.number().int().min(0),
});

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (err: unknown) {
    console.error('POST /api/meal-plan/log-planned: invalid JSON body', err);
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await logPlannedMealAction(parsed.data.slot);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({ ok: true });
}
