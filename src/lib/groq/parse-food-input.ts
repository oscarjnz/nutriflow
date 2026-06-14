import 'server-only';

import { nlpCacheKey } from '@/lib/crypto/hash';
import { groq, GROQ_MODELS } from '@/lib/groq/client';
import { buildUserPrompt, FOOD_EXTRACTION_SYSTEM_PROMPT } from '@/lib/groq/prompt';
import {
  type ParseFoodResult,
  type ParseResponse,
  parseFoodInputSchema,
  parseResponseSchema,
} from '@/lib/validation/nlp';
import { searchFoodCandidates } from '@/repositories/foods.repo';
import { bumpHit, findCachedParse, persistParse } from '@/repositories/nlp-cache.repo';

/**
 * `parseFoodInput` - the only entry point for turning free text into ranked
 * catalog candidates.
 *
 * Pipeline (CLAUDE.md §6, Sprint 0 task 10):
 *   1. Validate + normalize input.
 *   2. SHA-256(input) → look up `nlp_cache` under the current primary model.
 *   3. Hit: bump counters, reuse the cached extraction.
 *      Miss: call Groq (primary, then fallback) → validate JSON with Zod →
 *      persist under the primary model key.
 *   4. Re-rank each extracted item against the live catalog (deterministic).
 *
 * The LLM extraction is cached, but candidate ranking is always fresh so cache
 * hits reflect the current `foods` table. The model never produces macros.
 */

export type ParseOutcome =
  | { ok: true; result: ParseFoodResult }
  | { ok: false; reason: 'empty_input' | 'llm_unavailable' | 'invalid_llm_output' };

export async function parseFoodInput(rawText: string): Promise<ParseOutcome> {
  const input = parseFoodInputSchema.safeParse({ text: rawText });
  if (!input.success) {
    return { ok: false, reason: 'empty_input' };
  }

  const text = input.data.text;
  const model = GROQ_MODELS.primary;
  const hash = nlpCacheKey(text);

  const cached = await findCachedParse(hash, model);

  let extraction: ParseResponse;
  let fromCache: boolean;

  if (cached) {
    extraction = cached.parsed;
    fromCache = true;
    await bumpHit(cached.id);
  } else {
    const fresh = await extractWithFallback(text);
    if (!fresh.ok) return fresh;
    extraction = fresh.extraction;
    fromCache = false;
    await persistParse({ inputHash: hash, inputText: text, model, parsed: extraction });
  }

  const items = await Promise.all(
    extraction.items.map(async (extracted) => ({
      extracted,
      candidates: await searchFoodCandidates(extracted.queryTerms),
    })),
  );

  return { ok: true, result: { items, cached: fromCache, model } };
}

type ExtractResult =
  | { ok: true; extraction: ParseResponse }
  | { ok: false; reason: 'llm_unavailable' | 'invalid_llm_output' };

async function extractWithFallback(text: string): Promise<ExtractResult> {
  let gotAnyResponse = false;

  for (const model of [GROQ_MODELS.primary, GROQ_MODELS.fallback]) {
    let content: string;
    try {
      content = await requestCompletion(model, text);
      gotAnyResponse = true;
    } catch (err: unknown) {
      // Transport / API error: log with context and try the next model.
      console.error('groq.request_failed', { model, error: stringifyError(err) });
      continue;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch (err: unknown) {
      console.warn('groq.malformed_json', { model, error: stringifyError(err) });
      continue;
    }

    const parsed = parseResponseSchema.safeParse(raw);
    if (parsed.success) {
      return { ok: true, extraction: parsed.data };
    }
    console.warn('groq.schema_violation', { model, issues: parsed.error.issues });
  }

  return { ok: false, reason: gotAnyResponse ? 'invalid_llm_output' : 'llm_unavailable' };
}

async function requestCompletion(model: string, text: string): Promise<string> {
  const completion = await groq.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: FOOD_EXTRACTION_SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(text) },
    ],
  });

  const content = completion.choices[0]?.message.content;
  if (!content) {
    throw new Error('Groq returned an empty completion');
  }
  return content;
}

function stringifyError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}
