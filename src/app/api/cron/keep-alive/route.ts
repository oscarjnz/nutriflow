import { NextResponse } from 'next/server';

import { env } from '@/env.server';
import { pingDatabase } from '@/repositories/health.repo';

/**
 * Vercel Cron target (see `vercel.json`). Vercel signs cron requests with
 * `Authorization: Bearer $CRON_SECRET` when that env var is set on the
 * project, so we verify it here to stop this endpoint being triggered by
 * anyone who finds the URL. Runs on the Node runtime because `postgres-js`
 * needs a real TCP socket, which the Edge runtime does not provide.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    await pingDatabase();
    return NextResponse.json({ ok: true, pingedAt: new Date().toISOString() });
  } catch (error) {
    console.error('[cron/keep-alive] database ping failed', error);
    return NextResponse.json({ ok: false, error: 'database ping failed' }, { status: 500 });
  }
}
