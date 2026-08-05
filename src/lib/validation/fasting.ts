import { z } from 'zod';

import {
  FASTING_PROTOCOLS,
  MAX_TARGET_HOURS,
  MIN_TARGET_HOURS,
  targetHoursForProtocol,
} from '@/lib/fasting/protocol';

/**
 * Boundary schema for starting a fast.
 *
 * The refinement is the part that matters: without it a client could post
 * `{ protocol: '16:8', targetHours: 3 }` and the history would show a "16:8"
 * that ran for three hours. A named protocol must carry its own target; only
 * 'custom' is free to choose.
 */
export const startFastSchema = z
  .object({
    protocol: z.enum(FASTING_PROTOCOLS),
    targetHours: z.number().int().min(MIN_TARGET_HOURS).max(MAX_TARGET_HOURS),
  })
  .refine(
    (value) => {
      const expected = targetHoursForProtocol(value.protocol);
      return expected === null || expected === value.targetHours;
    },
    {
      message: 'targetHours must match the chosen protocol',
      path: ['targetHours'],
    },
  );

export type StartFast = z.infer<typeof startFastSchema>;
