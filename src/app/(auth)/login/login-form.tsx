'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Mail } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { signInWithGoogle, signInWithMagicLink } from '@/app/(auth)/login/actions';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { magicLinkSchema, type MagicLinkInput } from '@/lib/validation/auth';

export function LoginForm() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<MagicLinkInput>({
    resolver: zodResolver(magicLinkSchema),
    defaultValues: { email: '' },
  });

  function onSubmit(values: MagicLinkInput) {
    startTransition(async () => {
      const result = await signInWithMagicLink(values, nextPath);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSentTo(values.email);
    });
  }

  function onGoogle() {
    startTransition(async () => {
      const result = await signInWithGoogle(nextPath);
      if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  if (sentTo) {
    return (
      <div
        className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center"
        role="status"
        aria-live="polite"
      >
        <Mail className="mx-auto h-10 w-10 text-[var(--color-primary)]" aria-hidden />
        <h2 className="mt-4 text-lg font-semibold">Revisa tu correo</h2>
        <p className="text-[var(--color-muted-foreground)] mt-2 text-sm">
          Te enviamos un enlace de acceso a <span className="font-medium">{sentTo}</span>. Abrelo
          en este dispositivo para entrar.
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-4"
          onClick={() => {
            setSentTo(null);
            form.reset();
          }}
        >
          Usar otro correo
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button onClick={onGoogle} disabled={isPending} variant="outline" className="w-full">
        Continuar con Google
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <span className="w-full border-t border-[var(--color-border)]" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[var(--color-background)] text-[var(--color-muted-foreground)] px-2">
            o por correo
          </span>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Correo</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="tu@correo.com"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={isPending} className="w-full">
            Enviar enlace
          </Button>
        </form>
      </Form>
    </div>
  );
}
