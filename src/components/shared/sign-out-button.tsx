'use client';

import { LogOut } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';

import { signOut } from '@/app/(auth)/login/actions';
import { Button } from '@/components/ui/button';

export function SignOutButton() {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        await signOut();
      } catch (err: unknown) {
        console.error('signOut', err);
        toast.error('No pudimos cerrar tu sesion. Intentalo de nuevo.');
      }
    });
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={isPending} className="w-full">
      <LogOut className="h-4 w-4" />
      Cerrar sesion
    </Button>
  );
}
