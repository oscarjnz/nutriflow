import type { Metadata } from 'next';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireUser } from '@/lib/auth/get-user';

import { NlpTester } from './nlp-tester';

export const metadata: Metadata = { title: 'Probar NLP' };

export default async function NlpTestPage() {
  await requireUser();

  return (
    <main className="mx-auto w-full max-w-md space-y-5 p-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Probar extracción NLP</h1>
        <p className="text-[var(--color-muted-foreground)] text-sm">
          Escribe una comida en lenguaje natural. El modelo extrae los alimentos y el catálogo
          rankea los candidatos. Los cálculos de macros nunca vienen del modelo.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Entrada libre</CardTitle>
          <CardDescription>
            Ej: «dos huevos fritos, una taza de arroz blanco y medio aguacate»
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NlpTester />
        </CardContent>
      </Card>
    </main>
  );
}
