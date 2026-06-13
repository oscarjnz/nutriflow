'use client';

import { Home, Plus, Timer, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ComponentType } from 'react';

import { cn } from '@/lib/utils';

type NavItem = {
  href: '/' | '/log' | '/fasting' | '/profile';
  label: string;
  icon: ComponentType<{ className?: string }>;
  primary?: boolean;
};

const ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/log', label: 'Registrar', icon: Plus, primary: true },
  { href: '/fasting', label: 'Ayuno', icon: Timer },
  { href: '/profile', label: 'Perfil', icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegacion principal"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--color-border)]',
        'bg-[var(--color-background)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-background)]/80',
        'pb-[env(safe-area-inset-bottom)]',
      )}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 py-2 text-xs',
                  'min-h-14 transition-colors',
                  isActive
                    ? 'text-[var(--color-primary)]'
                    : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]',
                )}
              >
                {item.primary ? (
                  <span
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-full',
                      'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] shadow-md',
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </span>
                ) : (
                  <Icon className="h-5 w-5" />
                )}
                <span className={item.primary ? 'sr-only' : undefined}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
