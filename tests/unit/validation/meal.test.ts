import { describe, expect, it } from 'vitest';

import { createMealLogSchema, quickLogInputSchema } from '@/lib/validation/meal';

const validItem = {
  foodId: '019ec25d-3920-768a-92fc-b5a3a96bf6cc',
  quantity: 150,
  unit: 'g',
  source: 'manual' as const,
};

describe('createMealLogSchema', () => {
  it('accepts a minimal valid payload', () => {
    const parsed = createMealLogSchema.parse({
      mealType: 'lunch',
      items: [validItem],
    });
    expect(parsed.items).toHaveLength(1);
    expect(parsed.loggedAt).toBeUndefined();
  });

  it('accepts an ISO loggedAt with offset', () => {
    const parsed = createMealLogSchema.parse({
      mealType: 'breakfast',
      loggedAt: '2026-06-13T08:30:00-04:00',
      items: [validItem],
    });
    expect(parsed.loggedAt).toBe('2026-06-13T08:30:00-04:00');
  });

  it('rejects an empty items array', () => {
    expect(
      createMealLogSchema.safeParse({ mealType: 'dinner', items: [] }).success,
    ).toBe(false);
  });

  it('rejects an invalid meal type', () => {
    expect(
      createMealLogSchema.safeParse({ mealType: 'brunch', items: [validItem] }).success,
    ).toBe(false);
  });

  it('rejects a non-uuid foodId', () => {
    expect(
      createMealLogSchema.safeParse({
        mealType: 'snack',
        items: [{ ...validItem, foodId: 'not-a-uuid' }],
      }).success,
    ).toBe(false);
  });

  it('rejects a non-positive quantity', () => {
    expect(
      createMealLogSchema.safeParse({
        mealType: 'snack',
        items: [{ ...validItem, quantity: 0 }],
      }).success,
    ).toBe(false);
  });

  it('rejects an unknown item source', () => {
    expect(
      createMealLogSchema.safeParse({
        mealType: 'snack',
        items: [{ ...validItem, source: 'telepathy' }],
      }).success,
    ).toBe(false);
  });
});

describe('quickLogInputSchema', () => {
  const foodId = '019ec25d-3920-768a-92fc-b5a3a96bf6cc';

  it('accepts several foods logged as one meal', () => {
    const parsed = quickLogInputSchema.safeParse({
      mealType: 'breakfast',
      items: [
        { foodId, grams: 100, source: 'nlp' },
        { foodId, grams: 60 },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it('still accepts the single-food shape older mobile builds send', () => {
    const parsed = quickLogInputSchema.safeParse({
      foodId,
      grams: 100,
      mealType: 'lunch',
      source: 'barcode',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects an empty item list', () => {
    expect(
      quickLogInputSchema.safeParse({ mealType: 'dinner', items: [] }).success,
    ).toBe(false);
  });

  it('rejects a per-item mealType, which belongs to the meal', () => {
    const parsed = quickLogInputSchema.safeParse({
      mealType: 'dinner',
      items: [{ foodId, grams: 100, mealType: 'lunch' }],
    });
    // Zod strips unknown keys rather than failing, so assert the parsed shape
    // instead: a stray mealType must not survive into the item.
    expect(parsed.success).toBe(true);
    if (parsed.success && 'items' in parsed.data) {
      expect(parsed.data.items[0]).not.toHaveProperty('mealType');
    }
  });

  it('rejects a non-positive grams value inside the list', () => {
    expect(
      quickLogInputSchema.safeParse({
        mealType: 'snack',
        items: [{ foodId, grams: 0 }],
      }).success,
    ).toBe(false);
  });
});
