import 'server-only';

import OpenAI from 'openai';

import { env } from '@/env.server';

/**
 * Groq exposes an OpenAI-compatible Chat Completions API, so we reuse the
 * `openai` SDK pointed at Groq's base URL. Free tier, no credit card
 * (CLAUDE.md §3/§4). Models are read from env so they can be swapped without a
 * code change; swapping the model also invalidates `nlp_cache` via the
 * (input_hash, model) key.
 */
export const groq = new OpenAI({
  apiKey: env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

export const GROQ_MODELS = {
  primary: env.GROQ_MODEL_PRIMARY,
  fallback: env.GROQ_MODEL_FALLBACK,
} as const;
