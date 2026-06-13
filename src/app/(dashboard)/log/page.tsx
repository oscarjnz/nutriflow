import type { Metadata } from 'next';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Registrar' };

export default function LogPage() {
  return (
    <main className="space-y-6 p-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Registrar comida</h1>
        <p className="text-[var(--color-muted-foreground)] text-sm">
          Manual, NLP, codigo de barras, favoritos o recetas.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Proximamente</CardTitle>
        </CardHeader>
        <CardContent className="text-[var(--color-muted-foreground)] text-sm">
          El motor NLP y el registro manual llegan en el Lote 3.
        </CardContent>
      </Card>
    </main>
  );
}
