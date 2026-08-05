import type { Metadata } from 'next';

import { Card, CardContent } from '@/components/ui/card';
import { requireUser } from '@/lib/auth/get-user';
import { elapsedMs } from '@/lib/fasting/protocol';
import { displayedStreak, toDateKey } from '@/lib/fasting/streak';
import { getActiveFast, getFastingStreak, getRecentFasts } from '@/repositories/fasting.repo';

import { FastingHistory } from './fasting-history';
import { FastingPanel } from './fasting-panel';

export const metadata: Metadata = { title: 'Ayuno' };

export default async function FastingPage() {
  const user = await requireUser();

  const [active, streak, history] = await Promise.all([
    getActiveFast(user),
    getFastingStreak(user),
    getRecentFasts(user, 10),
  ]);

  // The stored counter is only meaningful next to its date: a streak whose last
  // completion was three days ago is over, even though the row still holds the
  // old number. `displayedStreak` decides what today's figure actually is.
  const currentStreak = displayedStreak(streak, toDateKey(new Date()));

  return (
    <main className="space-y-6 p-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Ayuno</h1>
        <p className="text-[var(--color-muted-foreground)] text-sm">
          {active ? 'Ayuno en curso.' : 'Elige un protocolo y arranca el temporizador.'}
        </p>
      </header>

      <FastingPanel
        active={active}
        initialElapsed={active ? elapsedMs(active.startAt) : 0}
        currentStreak={currentStreak}
        longestStreak={streak.longestCount}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Historial</h2>
        {history.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-[var(--color-muted-foreground)] text-sm">
                Todavía no has terminado ningún ayuno.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <FastingHistory sessions={history} />
            </CardContent>
          </Card>
        )}
      </section>

      <p className="text-[var(--color-muted-foreground)] px-1 text-xs">
        Las fases del ayuno son orientativas y varían entre personas. Si tienes alguna condición
        médica o tomas medicación, consulta a un profesional antes de ayunar.
      </p>
    </main>
  );
}
