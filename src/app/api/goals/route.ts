import { NextResponse } from 'next/server';

import { saveGoalAction } from '@/features/goals/actions';
import { getUser } from '@/lib/auth/get-user';
import { getActiveGoal } from '@/repositories/user-goals.repo';

/**
 * REST entry point for Flutter's goals screen.
 *
 * GET reads the active macro goal via the same repository the dashboard uses
 * (falls back to `DEFAULT_GOAL` when the user has none yet, same as web).
 * POST wraps `saveGoalAction` verbatim; body validation is `setGoalSchema`,
 * applied inside the action.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const goal = await getActiveGoal(user);
  return NextResponse.json({ ok: true, goal });
}

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (err: unknown) {
    console.error('POST /api/goals: invalid JSON body', err);
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const result = await saveGoalAction(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({ ok: true });
}
