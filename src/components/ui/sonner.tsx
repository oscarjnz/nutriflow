'use client';

import { useTheme } from 'next-themes';
import { Toaster as SonnerToaster, type ToasterProps } from 'sonner';

export function Toaster(props: ToasterProps) {
  const { theme = 'system' } = useTheme();
  return (
    <SonnerToaster
      theme={theme as ToasterProps['theme']}
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-[var(--color-card)] group-[.toaster]:text-[var(--color-card-foreground)] group-[.toaster]:border-[var(--color-border)] group-[.toaster]:shadow-lg',
        },
      }}
      {...props}
    />
  );
}
