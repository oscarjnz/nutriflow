import { describe, expect, it } from 'vitest';

import { createMealLogSchema } from '@/lib/validation/meal';

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
