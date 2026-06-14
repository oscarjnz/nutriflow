import { z } from 'zod';

/**
 * EAN/UPC/GTIN barcode boundary. OFF keys products by 8-14 digit codes
 * (EAN-8, UPC-A/12, EAN-13, GTIN-14). We strip whitespace so a user can type
 * the number in chunks; only digits remain.
 */
export const barcodeSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/\s+/g, ''))
  .pipe(z.string().regex(/^\d{8,14}$/, 'El código debe tener entre 8 y 14 dígitos.'));

export type Barcode = z.infer<typeof barcodeSchema>;
