'use client';

import { useClerk } from '@clerk/nextjs';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { Button } from '@/components/ui/button';

export function SignOutButton() {
  const { signOut } = useClerk();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await signOut();
      router.push('/sign-in');
    });
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={isPending} className="w-full">
      <LogOut className="h-4 w-4" />
      Cerrar sesion
    </Button>
  );
}
