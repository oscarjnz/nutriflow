'use client';

import { Home, Plus, Timer, UtensilsCrossed, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ComponentType } from 'react';

import { cn } from '@/lib/utils';

type NavItem = {
  href: '/' | '/plan' | '/log' | '/fasting' | '/profile';
  label: string;
  icon: ComponentType<{ className?: string }>;
  primary?: boolean;
};

const ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/plan', label: 'Plan', icon: UtensilsCrossed },
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
        'fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--color-border)] print:hidden',
        'bg-[var(--color-background)]/95 backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--color-background)]/75',
        'shadow-[0_-10px_30px_-18px_hsl(35_16%_15%/0.25)] dark:shadow-[0_-10px_30px_-18px_hsl(0_0%_0%/0.6)]',
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
                  'group flex flex-col items-center justify-center gap-1 py-2 text-xs',
                  'min-h-14 transition-colors duration-150',
                  isActive
                    ? 'text-[var(--color-primary)]'
                    : 'text-[var(--color-muted-foreground)] [@media(hover:hover)]:hover:text-[var(--color-foreground)]',
                )}
              >
                {item.primary ? (
                  <span
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-full',
                      'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]',
                      'shadow-[0_8px_22px_-6px_color-mix(in_srgb,var(--color-primary)_65%,transparent)]',
                      'transition-transform duration-150 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)]',
                      'group-hover:-translate-y-0.5 group-active:scale-90 motion-reduce:transform-none',
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </span>
                ) : (
                  <Icon
                    className={cn(
                      'h-5 w-5 transition-transform duration-150 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)]',
                      'group-active:scale-90 motion-reduce:transform-none',
                      isActive && '-translate-y-px',
                    )}
                  />
                )}
                <span className={item.primary ? 'sr-only' : undefined}>{item.label}</span>
                {!item.primary && (
                  <span
                    aria-hidden
                    className={cn(
                      'h-1 w-1 rounded-full bg-[var(--color-primary)]',
                      'transition-[opacity,transform] duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
                      isActive ? 'scale-100 opacity-100' : 'scale-0 opacity-0',
                    )}
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
