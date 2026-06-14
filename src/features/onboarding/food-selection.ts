/**
 * Config for the "available food selection by category" onboarding step.
 *
 * Plain data (no 'use client') so it is shared by the client wizard and the
 * server action that validates the submitted selection. Categories mirror
 * foods.category (migration 0013); 'other' is intentionally excluded - it holds
 * branded/packaged products that don't belong in a staples picker.
 */

/** Categories the picker shows, in display order. */
export type SelectableCategory =
  | 'protein'
  | 'grain'
  | 'vegetable'
  | 'fruit'
  | 'legume'
  | 'dairy'
  | 'fat';

export interface CategoryMeta {
  value: SelectableCategory;
  label: string;
  /** Short hint shown under the category title. */
  hint: string;
  /** Minimum foods the user must pick in this category to continue. */
  min: number;
}

/**
 * Minimums keep the Phase 3 meal generator viable: enough protein and produce
 * variety to assemble balanced plates. Legume/dairy/fat are optional (min 0)
 * because not every diet relies on them.
 */
export const CATEGORY_META: readonly CategoryMeta[] = [
  { value: 'protein', label: 'Proteínas', hint: 'Elige al menos 2.', min: 2 },
  { value: 'grain', label: 'Cereales y almidones', hint: 'Elige al menos 1.', min: 1 },
  { value: 'vegetable', label: 'Verduras', hint: 'Elige al menos 2.', min: 2 },
  { value: 'fruit', label: 'Frutas', hint: 'Elige al menos 1.', min: 1 },
  { value: 'fat', label: 'Grasas saludables', hint: 'Elige al menos 1.', min: 1 },
  { value: 'legume', label: 'Legumbres', hint: 'Opcional.', min: 0 },
  { value: 'dairy', label: 'Lácteos', hint: 'Opcional.', min: 0 },
] as const;

export interface SelectableFood {
  id: string;
  nameEs: string;
  category: SelectableCategory;
}

/**
 * Whether `selectedIds` satisfies every category minimum, given the catalog of
 * selectable foods. Used by both the wizard (to gate "Continuar") and the
 * server action (authoritative re-check).
 */
export function selectionMeetsMinimums(
  selectedIds: ReadonlySet<string>,
  catalog: readonly SelectableFood[],
): boolean {
  return CATEGORY_META.every((cat) => {
    if (cat.min === 0) return true;
    const count = catalog.filter(
      (f) => f.category === cat.value && selectedIds.has(f.id),
    ).length;
    return count >= cat.min;
  });
}
