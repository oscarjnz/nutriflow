'use client';

import { Flame, Play, Square, Trophy } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { FastRing } from '@/components/shared/fast-ring';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cancelFastAction, endFastAction, startFastAction } from '@/features/fasting/actions';
import {
  elapsedMs,
  fastingPhaseAt,
  formatCompactDuration,
  isGoalReached,
  MAX_TARGET_HOURS,
  MIN_TARGET_HOURS,
  overshootMs,
  PROTOCOL_PRESETS,
  remainingMs,
  targetReachedAt,
  type FastingProtocol,
} from '@/lib/fasting/protocol';
import { cn } from '@/lib/utils';
import type { ActiveFast } from '@/repositories/fasting.repo';

interface FastingPanelProps {
  active: ActiveFast | null;
  /**
   * Elapsed milliseconds as measured on the server at render time. Seeding the
   * clock from a prop (instead of reading Date.now() during render) keeps the
   * first client render byte-identical to the SSR output; the interval then
   * takes over and corrects any drift on the very next tick.
   */
  initialElapsed: number;
  currentStreak: number;
  longestStreak: number;
}

const DEFAULT_PROTOCOL: FastingProtocol = '16:8';
const DEFAULT_CUSTOM_HOURS = 24;

function timeLabel(date: Date): string {
  return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

function clampHours(n: number): number {
  return Math.min(MAX_TARGET_HOURS, Math.max(MIN_TARGET_HOURS, Math.round(n)));
}

/**
 * Caption under the clock. The sub-minute cases are spelled out rather than
 * formatted, because `formatCompactDuration` floors to whole minutes and would
 * otherwise render "faltan 0 min" for the last minute of a fast and
 * "+0 min de más" for the first one after the target.
 */
function captionFor(elapsed: number, targetHours: number, goalReached: boolean): string {
  if (goalReached) {
    const overshoot = overshootMs(elapsed, targetHours);
    return overshoot < 60_000 ? 'objetivo cumplido' : `+${formatCompactDuration(overshoot)} de más`;
  }

  const remaining = remainingMs(elapsed, targetHours);
  return remaining < 60_000 ? 'menos de 1 min' : `faltan ${formatCompactDuration(remaining)}`;
}

export function FastingPanel({
  active,
  initialElapsed,
  currentStreak,
  longestStreak,
}: FastingPanelProps) {
  return active ? (
    <ActiveFastView
      active={active}
      initialElapsed={initialElapsed}
      currentStreak={currentStreak}
      longestStreak={longestStreak}
    />
  ) : (
    <IdleView currentStreak={currentStreak} longestStreak={longestStreak} />
  );
}

// ── Running fast ────────────────────────────────────────────────────────────

function ActiveFastView({
  active,
  initialElapsed,
  currentStreak,
  longestStreak,
}: FastingPanelProps & { active: ActiveFast }) {
  const router = useRouter();
  const [elapsed, setElapsed] = useState(initialElapsed);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [pending, startMutation] = useTransition();

  const startAt = active.startAt;

  useEffect(() => {
    const sync = () => setElapsed(elapsedMs(startAt));
    sync();

    const id = window.setInterval(sync, 1000);
    // Background tabs throttle timers, so a fast can be minutes stale on
    // return. Every tick recomputes from startAt rather than incrementing, and
    // this listener refreshes the moment the tab is visible again.
    document.addEventListener('visibilitychange', sync);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [startAt]);

  const goalReached = isGoalReached(elapsed, active.targetHours);
  const phase = fastingPhaseAt(elapsed);
  const caption = captionFor(elapsed, active.targetHours, goalReached);

  const handleEnd = useCallback(() => {
    startMutation(async () => {
      const res = await endFastAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.data.goalReached) {
        toast.success(`Ayuno completado: ${res.data.durationLabel}`, {
          description:
            res.data.currentStreak > 1
              ? `Llevas ${res.data.currentStreak} días seguidos.`
              : 'Empiezas una racha nueva.',
        });
      } else {
        toast(`Ayuno cerrado: ${res.data.durationLabel}`, {
          description: 'No llegó al objetivo, así que no cuenta para la racha.',
        });
      }
      router.refresh();
    });
  }, [router]);

  const handleCancel = useCallback(() => {
    startMutation(async () => {
      const res = await cancelFastAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setConfirmingCancel(false);
      toast('Ayuno descartado');
      router.refresh();
    });
  }, [router]);

  return (
    <div className="space-y-5">
      <Card className="shadow-[var(--shadow-float)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-primary)_5%,var(--color-card)),var(--color-card)_55%)]">
        <CardContent className="space-y-5 pt-6">
          <FastRing
            elapsed={elapsed}
            targetHours={active.targetHours}
            caption={caption}
            goalReached={goalReached}
          />

          <dl className="text-[var(--color-muted-foreground)] flex items-center justify-center gap-6 text-xs">
            <div className="text-center">
              <dt>Empezaste</dt>
              <dd className="text-[var(--color-foreground)] font-medium tabular-nums">
                {timeLabel(startAt)}
              </dd>
            </div>
            <div aria-hidden className="bg-[var(--color-border)] h-8 w-px" />
            <div className="text-center">
              <dt>Objetivo</dt>
              <dd className="text-[var(--color-foreground)] font-medium tabular-nums">
                {timeLabel(targetReachedAt(startAt, active.targetHours))}
              </dd>
            </div>
          </dl>

          {confirmingCancel ? (
            <div className="space-y-3">
              <p className="text-[var(--color-muted-foreground)] text-center text-sm">
                Se descartará este ayuno y no quedará en tu historial.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setConfirmingCancel(false)}
                  disabled={pending}
                >
                  Volver
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleCancel}
                  disabled={pending}
                >
                  Descartar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleEnd} disabled={pending}>
                <Square className="h-4 w-4" />
                Terminar ayuno
              </Button>
              <Button
                variant="ghost"
                onClick={() => setConfirmingCancel(true)}
                disabled={pending}
              >
                Cancelar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-1 pt-6">
          <p className="text-[var(--color-muted-foreground)] text-xs">
            Fase aproximada · {phase.fromHours} h en adelante
          </p>
          <p className="font-semibold">{phase.label}</p>
          <p className="text-[var(--color-muted-foreground)] text-sm">{phase.detail}</p>
        </CardContent>
      </Card>

      <StreakCard current={currentStreak} longest={longestStreak} />
    </div>
  );
}

// ── No fast running ─────────────────────────────────────────────────────────

function IdleView({
  currentStreak,
  longestStreak,
}: {
  currentStreak: number;
  longestStreak: number;
}) {
  const router = useRouter();
  const [protocol, setProtocol] = useState<FastingProtocol>(DEFAULT_PROTOCOL);
  const [customHours, setCustomHours] = useState(DEFAULT_CUSTOM_HOURS);
  const [customText, setCustomText] = useState(String(DEFAULT_CUSTOM_HOURS));
  const [pending, startMutation] = useTransition();

  const preset = PROTOCOL_PRESETS.find((p) => p.protocol === protocol);
  const targetHours = preset ? preset.targetHours : customHours;
  const description = preset
    ? preset.description
    : 'Tú defines cuántas horas dura el ayuno.';

  function handleCustomBlur() {
    const parsed = Number(customText);
    const next = customText.trim() === '' || !Number.isFinite(parsed)
      ? customHours
      : clampHours(parsed);
    setCustomHours(next);
    setCustomText(String(next));
  }

  function handleStart() {
    startMutation(async () => {
      const res = await startFastAction({ protocol, targetHours });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Ayuno iniciado');
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <Card className="shadow-[var(--shadow-float)]">
        <CardContent className="space-y-5 pt-6">
          <div className="space-y-1">
            <h2 className="font-semibold">Elige tu protocolo</h2>
            <p className="text-[var(--color-muted-foreground)] text-sm">{description}</p>
          </div>

          {/*
            Toggle buttons rather than role="radio": a real radiogroup owes the
            user arrow-key navigation, and promising that semantic without
            implementing it reads worse to a screen reader than a plain group of
            pressed buttons, which Tab already handles correctly.
          */}
          <div role="group" aria-label="Protocolo de ayuno" className="flex flex-wrap gap-2">
            {PROTOCOL_PRESETS.map((p) => (
              <ProtocolPill
                key={p.protocol}
                label={p.label}
                selected={protocol === p.protocol}
                onSelect={() => setProtocol(p.protocol)}
              />
            ))}
            <ProtocolPill
              label="Personalizado"
              selected={protocol === 'custom'}
              onSelect={() => setProtocol('custom')}
            />
          </div>

          {protocol === 'custom' && (
            <div className="flex items-center gap-3">
              <Label htmlFor="custom-hours" className="shrink-0">
                Horas de ayuno
              </Label>
              {/*
                Clamping happens on blur, never on keystroke: clamping live
                would snap "2" up to the minimum while the user is still typing
                "24". Same lesson already learned in the onboarding inputs.
              */}
              <Input
                id="custom-hours"
                type="number"
                inputMode="numeric"
                min={MIN_TARGET_HOURS}
                max={MAX_TARGET_HOURS}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                onBlur={handleCustomBlur}
                className="w-24 tabular-nums"
              />
              <span className="text-[var(--color-muted-foreground)] shrink-0 text-xs">
                {MIN_TARGET_HOURS} a {MAX_TARGET_HOURS}
              </span>
            </div>
          )}

          <Button className="w-full" onClick={handleStart} disabled={pending}>
            <Play className="h-4 w-4" />
            Empezar ayuno de {targetHours} h
          </Button>
        </CardContent>
      </Card>

      <StreakCard current={currentStreak} longest={longestStreak} />
    </div>
  );
}

function ProtocolPill({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'rounded-full border px-4 py-2 text-sm font-medium',
        'transition-[background-color,border-color,color,transform] duration-150',
        '[transition-timing-function:cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:transform-none',
        selected
          ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
          : 'border-[var(--color-border)] text-[var(--color-muted-foreground)] [@media(hover:hover)]:hover:text-[var(--color-foreground)]',
      )}
    >
      {label}
    </button>
  );
}

function StreakCard({ current, longest }: { current: number; longest: number }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-around pt-6">
        <div className="flex items-center gap-3">
          <span className="bg-[var(--color-muted)] flex h-10 w-10 items-center justify-center rounded-full">
            <Flame className="text-[var(--color-primary)] h-5 w-5" />
          </span>
          <div>
            <p className="text-xl font-bold tabular-nums leading-none">{current}</p>
            <p className="text-[var(--color-muted-foreground)] mt-1 text-xs">
              {current === 1 ? 'día seguido' : 'días seguidos'}
            </p>
          </div>
        </div>
        <div aria-hidden className="bg-[var(--color-border)] h-10 w-px" />
        <div className="flex items-center gap-3">
          <span className="bg-[var(--color-muted)] flex h-10 w-10 items-center justify-center rounded-full">
            <Trophy className="text-[var(--color-muted-foreground)] h-5 w-5" />
          </span>
          <div>
            <p className="text-xl font-bold tabular-nums leading-none">{longest}</p>
            <p className="text-[var(--color-muted-foreground)] mt-1 text-xs">mejor racha</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
