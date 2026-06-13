import { describe, expect, it } from 'vitest';

import { isMassUnit, normalizeUnit, toGrams } from '@/lib/nutrition/units';

describe('normalizeUnit', () => {
  it('maps Spanish colloquial units', () => {
    expect(normalizeUnit('gramos')).toBe('g');
    expect(normalizeUnit('Kilos')).toBe('kg');
    expect(normalizeUnit('cucharada')).toBe('tbsp');
    expect(normalizeUnit('cucharadita')).toBe('tsp');
    expect(normalizeUnit('taza')).toBe('cup');
    expect(normalizeUnit('unidades')).toBe('unit');
    expect(normalizeUnit('porciones')).toBe('serving');
  });

  it('is accent and case insensitive', () => {
    expect(normalizeUnit('Cucharadás')).toBe('tbsp');
    expect(normalizeUnit('  ONZAS ')).toBe('oz');
  });

  it('strips a trailing period', () => {
    expect(normalizeUnit('g.')).toBe('g');
  });

  it('returns null for unknown units', () => {
    expect(normalizeUnit('puñaditos')).toBeNull();
    expect(normalizeUnit('')).toBeNull();
  });
});

describe('isMassUnit', () => {
  it('classifies mass vs portion units', () => {
    expect(isMassUnit('g')).toBe(true);
    expect(isMassUnit('lb')).toBe(true);
    expect(isMassUnit('cup')).toBe(false);
    expect(isMassUnit('unit')).toBe(false);
  });
});

describe('toGrams — mass units', () => {
  it('converts each mass unit exactly', () => {
    expect(toGrams(1, 'g')).toEqual({ ok: true, grams: 1, unit: 'g' });
    expect(toGrams(2, 'kg')).toEqual({ ok: true, grams: 2000, unit: 'kg' });
    expect(toGrams(500, 'mg')).toEqual({ ok: true, grams: 0.5, unit: 'mg' });
    expect(toGrams(1, 'oz')).toEqual({ ok: true, grams: 28.349523125, unit: 'oz' });
    expect(toGrams(1, 'lb')).toEqual({ ok: true, grams: 453.59237, unit: 'lb' });
  });

  it('ignores gramsPerUnit for mass units', () => {
    expect(toGrams(3, 'g', 999)).toEqual({ ok: true, grams: 3, unit: 'g' });
  });
});

describe('toGrams — portion units', () => {
  it('uses gramsPerUnit for portion units', () => {
    expect(toGrams(2, 'taza', 158)).toEqual({ ok: true, grams: 316, unit: 'cup' });
    expect(toGrams(1, 'unidad', 50)).toEqual({ ok: true, grams: 50, unit: 'unit' });
  });

  it('fails when gramsPerUnit is missing', () => {
    expect(toGrams(1, 'taza')).toEqual({ ok: false, reason: 'missing_portion_grams' });
    expect(toGrams(1, 'taza', null)).toEqual({ ok: false, reason: 'missing_portion_grams' });
  });

  it('fails when gramsPerUnit is non-positive or non-finite', () => {
    expect(toGrams(1, 'taza', 0)).toEqual({ ok: false, reason: 'invalid_quantity' });
    expect(toGrams(1, 'taza', -5)).toEqual({ ok: false, reason: 'invalid_quantity' });
    expect(toGrams(1, 'taza', Number.NaN)).toEqual({ ok: false, reason: 'invalid_quantity' });
  });
});

describe('toGrams — invalid input', () => {
  it('rejects non-positive or non-finite quantities', () => {
    expect(toGrams(0, 'g')).toEqual({ ok: false, reason: 'invalid_quantity' });
    expect(toGrams(-1, 'g')).toEqual({ ok: false, reason: 'invalid_quantity' });
    expect(toGrams(Number.POSITIVE_INFINITY, 'g')).toEqual({
      ok: false,
      reason: 'invalid_quantity',
    });
  });

  it('rejects unknown units', () => {
    expect(toGrams(1, 'cucharaditas mágicas')).toEqual({ ok: false, reason: 'unknown_unit' });
  });
});
