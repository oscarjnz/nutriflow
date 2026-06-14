import type { Metadata } from 'next';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Ayuno' };

export default function FastingPage() {
  return (
    <main className="space-y-6 p-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Ayuno</h1>
        <p className="text-[var(--color-muted-foreground)] text-sm">
          Temporizador, historial y rachas.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Proximamente</CardTitle>
        </CardHeader>
        <CardContent className="text-[var(--color-muted-foreground)] text-sm">
          La gestion de ayuno intermitente entra en el Sprint 5.
        </CardContent>
      </Card>
    </main>
  );
}
