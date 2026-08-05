import { Check, Minus } from 'lucide-react';

import { durationMs, formatCompactDuration } from '@/lib/fasting/protocol';
import { cn } from '@/lib/utils';
import type { CompletedFast } from '@/repositories/fasting.repo';

/**
 * Read-only list of finished fasts. A server component on purpose: it has no
 * interaction, so it ships zero JavaScript and the dates are formatted once.
 */
export function FastingHistory({ sessions }: { sessions: CompletedFast[] }) {
  return (
    <ul>
      {sessions.map((session, index) => {
        const duration = durationMs(session.startAt, session.endAt);
        return (
          <li
            key={session.id}
            className={cn(
              'flex items-center justify-between gap-3 px-5 py-3',
              index > 0 && 'border-t border-[var(--color-border)]',
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  session.goalReached
                    ? 'bg-[color-mix(in_srgb,var(--color-primary)_16%,transparent)] text-[var(--color-primary)]'
                    : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
                )}
              >
                {session.goalReached ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Minus className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium tabular-nums">
                  {formatCompactDuration(duration)}
                </p>
                <p className="text-[var(--color-muted-foreground)] text-xs">
                  {session.protocol === 'custom'
                    ? `Personalizado · objetivo ${session.targetHours} h`
                    : `${session.protocol} · objetivo ${session.targetHours} h`}
                </p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm tabular-nums">{dayLabel(session.endAt)}</p>
              <p className="text-[var(--color-muted-foreground)] text-xs">
                <span className="sr-only">
                  {session.goalReached ? 'Objetivo alcanzado' : 'Objetivo no alcanzado'}
                </span>
                <span aria-hidden>{session.goalReached ? 'Completado' : 'Corto'}</span>
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function dayLabel(date: Date): string {
  return date.toLocaleDateString('es', { day: '2-digit', month: 'short' });
}
