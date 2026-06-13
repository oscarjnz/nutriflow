'use client';

import { Loader2, Sparkles } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import type { ParseOutcome } from '@/lib/groq/parse-food-input';
import type { FoodCandidate } from '@/lib/validation/nlp';

import { runParse } from './actions';

type ParseSuccess = Extract<ParseOutcome, { ok: true }>;
type ResultItems = ParseSuccess['result']['items'];

const ERROR_COPY: Record<Exclude<ParseOutcome, { ok: true }>['reason'], string> = {
  empty_input: 'Escribe al menos una comida.',
  llm_unavailable: 'El servicio de extracción no está disponible ahora. Intenta de nuevo.',
  invalid_llm_output: 'No pudimos interpretar el texto. Prueba con una frase más simple.',
};

export function NlpTester() {
  const [text, setText] = useState('');
  const [outcome, setOutcome] = useState<ParseOutcome | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) {
      toast.error('Escribe una comida primero.');
      return;
    }
    startTransition(async () => {
      try {
        const result = await runParse(text);
        setOutcome(result);
        if (!result.ok) toast.error(ERROR_COPY[result.reason]);
      } catch (err: unknown) {
        console.error('runParse', err);
        toast.error('Algo falló al procesar. Intenta de nuevo.');
      }
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <label htmlFor="nlp-input" className="sr-only">
          Comida en lenguaje natural
        </label>
        <textarea
          id="nlp-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="dos huevos fritos y una taza de arroz blanco"
          className="flex w-full resize-none rounded-lg border border-[var(--color-input)] bg-[var(--color-background)] px-3 py-2 text-base placeholder:text-[var(--color-muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)] disabled:opacity-50"
          disabled={isPending}
        />
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Procesando…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Extraer alimentos
            </>
          )}
        </Button>
      </form>

      {outcome?.ok && <Results items={outcome.result.items} cached={outcome.result.cached} model={outcome.result.model} />}
    </div>
  );
}

function Results({
  items,
  cached,
  model,
}: {
  items: ResultItems;
  cached: boolean;
  model: string;
}) {
  return (
    <section className="space-y-3" aria-live="polite">
      <div className="flex items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
            cached
              ? 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
              : 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
          }`}
        >
          {cached ? 'desde caché' : 'extracción nueva'}
        </span>
        <span className="truncate font-mono">{model}</span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No se detectaron alimentos en el texto.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item, i) => (
            <li
              key={`${item.extracted.raw}-${i}`}
              className="rounded-xl border border-[var(--color-border)] p-3"
              style={{
                animation: 'nlp-in 300ms cubic-bezier(0.23,1,0.32,1) both',
                animationDelay: `${i * 50}ms`,
              }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{item.extracted.name}</span>
                <span className="text-xs text-[var(--color-muted-foreground)]">
                  {item.extracted.quantity} {item.extracted.unit}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                «{item.extracted.raw}»
              </p>
              <CandidateList candidates={item.candidates} />
            </li>
          ))}
        </ul>
      )}

      <style>{`@keyframes nlp-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </section>
  );
}

function CandidateList({ candidates }: { candidates: FoodCandidate[] }) {
  if (candidates.length === 0) {
    return (
      <p className="mt-2 text-xs text-[var(--color-destructive)]">
        Sin coincidencias en el catálogo.
      </p>
    );
  }

  return (
    <ol className="mt-2 space-y-1.5">
      {candidates.map((c) => (
        <li key={c.foodId} className="flex items-center gap-2 text-sm">
          <span className="flex-1 truncate">{c.nameEs}</span>
          <span
            className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--color-muted)]"
            aria-hidden
          >
            <span
              className="block h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-300 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)]"
              style={{ width: `${Math.round(c.score * 100)}%` }}
            />
          </span>
          <span className="w-9 text-right text-xs tabular-nums text-[var(--color-muted-foreground)]">
            {Math.round(c.score * 100)}%
          </span>
        </li>
      ))}
    </ol>
  );
}
