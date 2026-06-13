import type { Metadata } from 'next';

import { SignOutButton } from '@/components/shared/sign-out-button';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireUser } from '@/lib/auth/get-user';

export const metadata: Metadata = { title: 'Perfil' };

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <main className="space-y-6 p-5">
      <header className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
          <p className="text-[var(--color-muted-foreground)] text-sm">{user.email}</p>
        </div>
        <ThemeToggle />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Cuenta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--color-muted-foreground)]">Correo</dt>
              <dd className="font-medium">{user.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--color-muted-foreground)]">Proveedor</dt>
              <dd className="font-medium capitalize">{user.app_metadata.provider ?? 'email'}</dd>
            </div>
          </dl>
          <SignOutButton />
        </CardContent>
      </Card>
    </main>
  );
}
