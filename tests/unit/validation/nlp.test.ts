import { describe, expect, it } from 'vitest';

import { parseFoodInputSchema, parseResponseSchema } from '@/lib/validation/nlp';

describe('parseResponseSchema (LLM contract)', () => {
  it('accepts a well-formed extraction', () => {
    const valid = {
      items: [
        {
          raw: 'dos huevos fritos',
          name: 'huevo frito',
          nameEn: 'fried egg',
          quantity: 2,
          unit: 'unidad',
          queryTerms: ['huevo', 'egg', 'fried'],
        },
      ],
    };
    expect(parseResponseSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts an empty items array', () => {
    expect(parseResponseSchema.safeParse({ items: [] }).success).toBe(true);
  });

  it('rejects a missing items key', () => {
    expect(parseResponseSchema.safeParse({}).success).toBe(false);
  });

  it('rejects calories leaking into the response (model must not compute)', () => {
    const withCalories = {
      items: [
        {
          raw: 'arroz',
          name: 'arroz',
          quantity: 1,
          unit: 'taza',
          queryTerms: ['arroz'],
          calories: 200,
        },
      ],
    };
    // Extra keys are stripped by Zod object parsing; the parsed result must not
    // surface a calories field.
    const parsed = parseResponseSchema.parse(withCalories);
    expect(parsed.items[0]).not.toHaveProperty('calories');
  });

  it('rejects non-positive quantity', () => {
    const bad = {
      items: [{ raw: 'x', name: 'x', quantity: 0, unit: 'g', queryTerms: ['x'] }],
    };
    expect(parseResponseSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects empty queryTerms', () => {
    const bad = {
      items: [{ raw: 'x', name: 'x', quantity: 1, unit: 'g', queryTerms: [] }],
    };
    expect(parseResponseSchema.safeParse(bad).success).toBe(false);
  });
});

describe('parseFoodInputSchema', () => {
  it('trims and accepts valid text', () => {
    const parsed = parseFoodInputSchema.parse({ text: '  pollo con arroz  ' });
    expect(parsed.text).toBe('pollo con arroz');
  });

  it('rejects empty text', () => {
    expect(parseFoodInputSchema.safeParse({ text: '   ' }).success).toBe(false);
  });

  it('rejects text over the limit', () => {
    expect(parseFoodInputSchema.safeParse({ text: 'a'.repeat(501) }).success).toBe(false);
  });
});
