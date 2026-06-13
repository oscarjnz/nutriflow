import { z } from 'zod';

/**
 * Client-safe environment variables, validated **lazily, per variable**.
 *
 * Only `NEXT_PUBLIC_*` vars are statically inlined by Next.js into the client
 * bundle, so this module is safe to import anywhere. Like `env.server`, each
 * field is validated on first access (and cached) so one missing var only
 * breaks the code path that reads it, not the whole app.
 *
 * NOTE: Next.js inlines NEXT_PUBLIC_* by literal `process.env.X` reference at
 * build time, so we must read each one explicitly rather than indexing
 * `process.env` dynamically.
 */

const fieldSchemas = {
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
} as const;

type FieldKey = keyof typeof fieldSchemas;
export type ClientEnv = { [K in FieldKey]: z.infer<(typeof fieldSchemas)[K]> };

// Explicit literals so Next.js can inline them; dynamic indexing would not work.
const rawValues: Record<FieldKey, string | undefined> = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
};

const cache = new Map<FieldKey, unknown>();

function readVar<K extends FieldKey>(key: K): ClientEnv[K] {
  if (cache.has(key)) return cache.get(key) as ClientEnv[K];

  const parsed = fieldSchemas[key].safeParse(rawValues[key]);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => i.message).join('; ');
    throw new Error(`Invalid client environment variable ${key}: ${issues}`);
  }

  cache.set(key, parsed.data);
  return parsed.data as ClientEnv[K];
}

export const clientEnv: ClientEnv = new Proxy({} as ClientEnv, {
  get(_target, prop) {
    if (typeof prop !== 'string' || !(prop in fieldSchemas)) {
      return undefined;
    }
    return readVar(prop as FieldKey);
  },
});
