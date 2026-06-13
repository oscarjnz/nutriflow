import { z } from 'zod';

/**
 * Server-only environment variables, validated **lazily, per variable**.
 *
 * Each field is checked the first time it is accessed (and the result cached),
 * not all at once on import. This means a missing/invalid variable only breaks
 * the feature that actually uses it — a missing GROQ_API_KEY breaks the NLP
 * path, not the dashboard — instead of crashing the whole app at boot.
 *
 * Importing this module from client code throws, because these secrets are
 * never present in the client bundle (no NEXT_PUBLIC_ prefix).
 */

if (typeof window !== 'undefined') {
  throw new Error('env.server.ts must not be imported from client code');
}

const fieldSchemas = {
  // Clerk
  CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY is required'),

  // Supabase (server — DB only, not auth)
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // Postgres
  DATABASE_URL_DIRECT: z
    .string()
    .url()
    .refine((u) => u.startsWith('postgres'), 'DATABASE_URL_DIRECT must be a postgres URL'),
  DATABASE_URL_POOLER: z
    .string()
    .url()
    .refine((u) => u.startsWith('postgres'), 'DATABASE_URL_POOLER must be a postgres URL'),

  // Groq
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required'),
  GROQ_MODEL_PRIMARY: z.string().min(1).default('llama-3.1-8b-instant'),
  GROQ_MODEL_FALLBACK: z.string().min(1).default('openai/gpt-oss-120b'),

  // USDA FoodData Central (seed script reads process.env directly; kept here
  // for documentation and in case server code ever needs it)
  FDC_API_KEY: z.string().min(1, 'FDC_API_KEY is required'),

  // Runtime
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
} as const;

type FieldKey = keyof typeof fieldSchemas;
export type ServerEnv = { [K in FieldKey]: z.infer<(typeof fieldSchemas)[K]> };

const cache = new Map<FieldKey, unknown>();

function readVar<K extends FieldKey>(key: K): ServerEnv[K] {
  if (cache.has(key)) return cache.get(key) as ServerEnv[K];

  const parsed = fieldSchemas[key].safeParse(process.env[key]);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => i.message).join('; ');
    throw new Error(`Invalid server environment variable ${key}: ${issues}`);
  }

  cache.set(key, parsed.data);
  return parsed.data as ServerEnv[K];
}

/**
 * Access server env vars via `env.GROQ_API_KEY`. Validation happens on first
 * access. Unknown keys and symbol probes (e.g. promise/inspect checks) return
 * undefined rather than throwing, so the object stays safe to pass around.
 */
export const env: ServerEnv = new Proxy({} as ServerEnv, {
  get(_target, prop) {
    if (typeof prop !== 'string' || !(prop in fieldSchemas)) {
      return undefined;
    }
    return readVar(prop as FieldKey);
  },
});
