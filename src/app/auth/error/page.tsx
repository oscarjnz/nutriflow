import Link from 'next/link';

import { Button } from '@/components/ui/button';

const REASONS: Record<string, string> = {
  missing_code: 'El enlace de acceso no es valido o esta incompleto.',
  exchange_failed: 'El enlace expiro o ya fue usado. Solicita uno nuevo.',
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message = (reason && REASONS[reason]) ?? 'No pudimos completar el inicio de sesion.';

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <h1 className="text-2xl font-semibold">Algo salio mal</h1>
      <p className="text-[var(--color-muted-foreground)]">{message}</p>
      <Button asChild>
        <Link href="/login">Volver al inicio de sesion</Link>
      </Button>
    </main>
  );
}
