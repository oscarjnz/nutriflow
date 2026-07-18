import { NextResponse } from 'next/server';

import { lookupBarcodeAction } from '@/features/logging/actions';
import { getUser } from '@/lib/auth/get-user';

/**
 * REST entry point for Flutter's barcode-scan logging flow (Fase 3.5).
 * Wraps `lookupBarcodeAction` verbatim - barcode validation (`barcodeSchema`)
 * and the Open Food Facts lookup/import happen there, not here, same pattern
 * as `goals`/`logging/log-meal` (CLAUDE.md §2).
 *
 * Body: `{ barcode: string }` (8-14 digit EAN/UPC/GTIN). Response on success:
 * `{ food: FoodSearchResult }` - the resolved/imported catalog food, ready to
 * pass straight into `POST /api/logging/log-meal` as `foodId` (with
 * `source: 'barcode'`).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (err: unknown) {
    console.error('POST /api/foods/barcode-lookup: invalid JSON body', err);
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const barcode = (body as { barcode?: unknown } | null)?.barcode;
  if (typeof barcode !== 'string') {
    return NextResponse.json({ error: 'barcode debe ser un texto.' }, { status: 400 });
  }

  const result = await lookupBarcodeAction(barcode);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({ food: result.food });
}
