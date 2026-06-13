'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

const ORDER = ['system', 'light', 'dark'] as const;
type ThemeName = (typeof ORDER)[number];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch: next-themes resolves the theme client-side only.
  useEffect(() => setMounted(true), []);

  function cycle() {
    const current = (theme ?? 'system') as ThemeName;
    const idx = ORDER.indexOf(current);
    const next = ORDER[(idx + 1) % ORDER.length] ?? 'system';
    setTheme(next);
  }

  const current = mounted ? ((theme ?? 'system') as ThemeName) : 'system';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycle}
      aria-label={`Tema actual: ${current}. Cambiar tema.`}
      title={`Tema: ${current}`}
    >
      {current === 'light' ? (
        <Sun className="h-5 w-5" />
      ) : current === 'dark' ? (
        <Moon className="h-5 w-5" />
      ) : (
        <Monitor className="h-5 w-5" />
      )}
    </Button>
  );
}
