import { z } from 'zod';

export const magicLinkSchema = z.object({
  email: z
    .string({ required_error: 'Ingresa tu correo' })
    .trim()
    .toLowerCase()
    .min(1, 'Ingresa tu correo')
    .email('Correo invalido')
    .max(254, 'Correo demasiado largo'),
});

export type MagicLinkInput = z.infer<typeof magicLinkSchema>;
