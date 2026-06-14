import { UserButton } from '@clerk/nextjs';
import { Target } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { OffAttribution } from '@/components/shared/off-attribution';
import { SignOutButton } from '@/components/shared/sign-out-button';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireUser } from '@/lib/auth/get-user';

export const metadata: Metadata = { title: 'Perfil' };

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <main className="space-y-6 p-5">
      <header className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <UserButton />
          <div className="space-y-0.5">
            <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
            {user.displayName && (
              <p className="text-[var(--color-muted-foreground)] text-sm">{user.displayName}</p>
            )}
          </div>
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
              <dt className="text-[var(--color-muted-foreground)]">Nombre</dt>
              <dd className="font-medium">{user.displayName ?? 'Sin definir'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--color-muted-foreground)]">Unidades</dt>
              <dd className="font-medium capitalize">{user.units}</dd>
            </div>
          </dl>
          <Button asChild variant="outline" className="w-full">
            <Link href="/goals">
              <Target className="h-4 w-4" />
              Ajustar metas
            </Link>
          </Button>
          <SignOutButton />
        </CardContent>
      </Card>

      <OffAttribution className="text-center" />
    </main>
  );
}
