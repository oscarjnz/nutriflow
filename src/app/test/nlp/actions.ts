'use server';

import { requireUser } from '@/lib/auth/get-user';
import { parseFoodInput, type ParseOutcome } from '@/lib/groq/parse-food-input';

/**
 * Server Action wrapper for the NLP test page. Requires a session (the page is
 * already behind middleware) and delegates to the deterministic pipeline.
 */
export async function runParse(text: string): Promise<ParseOutcome> {
  await requireUser();
  return parseFoodInput(text);
}
