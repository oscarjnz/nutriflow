import { z } from 'zod';

/**
 * Server-only environment variables.
 *
 * Importing this module from client code will crash the build because
 * `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, etc. are never defined in the
 * client bundle (they are not prefixed with `NEXT_PUBLIC_`). Keep server
 * secrets out of any file that may be reached from a Client Component.
 */
const schema = z.object({
  // Supabase (server)
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

  // USDA FoodData Central (used by seed script only)
  FDC_API_KEY: z.string().min(1, 'FDC_API_KEY is required'),

  // Runtime
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

if (typeof window !== 'undefined') {
  throw new Error('env.server.ts must not be imported from client code');
}

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`Invalid server environment variables:\n${issues}`);
}

export const env = parsed.data;
export type ServerEnv = z.infer<typeof schema>;
