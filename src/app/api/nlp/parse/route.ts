import { NextResponse } from 'next/server';

import { runParse } from '@/app/test/nlp/actions';
import { getUser } from '@/lib/auth/get-user';
import { parseFoodInputSchema } from '@/lib/validation/nlp';

/**
 * REST entry point for Flutter's NLP logging flow. Wraps `runParse` (the same
 * function the `/test/nlp` harness exercises), which delegates to the
 * deterministic `parseFoodInput` pipeline (CLAUDE.md §6: the LLM only
 * extracts/normalizes entities, it never computes macros). Body:
 * `{ "text": string }`.
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
    console.error('POST /api/nlp/parse: invalid JSON body', err);
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = parseFoodInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const outcome = await runParse(parsed.data.text);
  if (!outcome.ok) {
    const status =
      outcome.reason === 'empty_input' ? 400 : outcome.reason === 'llm_unavailable' ? 503 : 502;
    return NextResponse.json({ error: outcome.reason }, { status });
  }

  return NextResponse.json({ ok: true, result: outcome.result });
}
