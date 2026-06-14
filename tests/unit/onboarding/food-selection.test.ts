import { describe, expect, it } from 'vitest';

import {
  CATEGORY_META,
  type SelectableFood,
  selectionMeetsMinimums,
} from '@/features/onboarding/food-selection';

/** Build a catalog with `count` foods in each category, ids like "protein-0". */
function catalog(count: number): SelectableFood[] {
  return CATEGORY_META.flatMap((cat) =>
    Array.from({ length: count }, (_, i) => ({
      id: `${cat.value}-${i}`,
      nameEs: `${cat.value} ${i}`,
      category: cat.value,
    })),
  );
}

describe('selectionMeetsMinimums', () => {
  const foods = catalog(3);

  it('fails when no foods are selected and some categories require a minimum', () => {
    expect(selectionMeetsMinimums(new Set(), foods)).toBe(false);
  });

  it('passes when every category minimum is met exactly', () => {
    const selected = new Set<string>();
    for (const cat of CATEGORY_META) {
      for (let i = 0; i < cat.min; i += 1) selected.add(`${cat.value}-${i}`);
    }
    expect(selectionMeetsMinimums(selected, foods)).toBe(true);
  });

  it('fails when a single required category is one short', () => {
    const selected = new Set<string>();
    for (const cat of CATEGORY_META) {
      for (let i = 0; i < cat.min; i += 1) selected.add(`${cat.value}-${i}`);
    }
    // Drop one protein (protein has min 2).
    selected.delete('protein-0');
    expect(selectionMeetsMinimums(selected, foods)).toBe(false);
  });

  it('ignores selected ids that are not in the catalog', () => {
    const selected = new Set<string>(['ghost-1', 'ghost-2']);
    for (const cat of CATEGORY_META) {
      for (let i = 0; i < cat.min; i += 1) selected.add(`${cat.value}-${i}`);
    }
    expect(selectionMeetsMinimums(selected, foods)).toBe(true);
  });

  it('treats optional categories (min 0) as always satisfied', () => {
    const optional = CATEGORY_META.filter((c) => c.min === 0);
    expect(optional.length).toBeGreaterThan(0);
  });
});
