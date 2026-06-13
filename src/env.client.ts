import { z } from 'zod';

/**
 * Client-safe environment variables.
 *
 * Only `NEXT_PUBLIC_*` vars are statically inlined by Next.js into the client
 * bundle. References to non-public vars on the client resolve to `undefined`.
 * This module is safe to import from any component.
 */
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
});

const parsed = schema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`Invalid client environment variables:\n${issues}`);
}

export const clientEnv = parsed.data;
export type ClientEnv = z.infer<typeof schema>;
