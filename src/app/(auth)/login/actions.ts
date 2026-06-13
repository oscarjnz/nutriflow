'use server';

import { redirect } from 'next/navigation';

import { clientEnv } from '@/env.client';
import { createClient } from '@/lib/supabase/server';
import { magicLinkSchema, type MagicLinkInput } from '@/lib/validation/auth';

export type ActionResult = { ok: true } | { ok: false; error: string };

function callbackUrl(next?: string | null): string {
  const base = `${clientEnv.NEXT_PUBLIC_APP_URL}/auth/callback`;
  if (!next || !next.startsWith('/')) return base;
  return `${base}?next=${encodeURIComponent(next)}`;
}

/**
 * Send a one-time login link to the given email. The link redirects the
 * browser to `/auth/callback?code=…&next=<path>` after click.
 */
export async function signInWithMagicLink(
  input: MagicLinkInput,
  next?: string | null,
): Promise<ActionResult> {
  const parsed = magicLinkSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Correo invalido' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: callbackUrl(next),
      shouldCreateUser: true,
    },
  });

  if (error) {
    console.error('signInWithMagicLink', error);
    return { ok: false, error: 'No pudimos enviar el enlace. Intentalo de nuevo.' };
  }

  return { ok: true };
}

/**
 * Start the Google OAuth flow. On success the browser is redirected to
 * Google by the runtime; this function never returns normally in that case.
 */
export async function signInWithGoogle(next?: string | null): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl(next),
    },
  });

  if (error) {
    console.error('signInWithGoogle', error);
    return { ok: false, error: 'No pudimos iniciar sesion con Google.' };
  }
  if (!data.url) {
    return { ok: false, error: 'Respuesta inesperada del proveedor.' };
  }

  redirect(data.url);
}

export async function signOut(): Promise<never> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('signOut', error);
  }
  redirect('/login');
}
