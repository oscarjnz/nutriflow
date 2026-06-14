/**
 * Pure helpers behind the onboarding numeric inputs. Kept framework-free so the
 * buffering behaviour (type freely, clamp only on blur) is unit-testable without
 * a DOM. The bug these fix: clamping on every keystroke snapped the field to its
 * minimum mid-edit, so values could not be changed.
 */

export function clampNumber(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Value to propagate live while the user types. Returns null for empty/partial
 * or non-numeric input so the committed value is left untouched until blur.
 * Note: intentionally does NOT clamp - intermediate values below the minimum
 * (e.g. "2" on the way to "25") must be allowed.
 */
export function liveValue(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Value to commit on blur: the typed number clamped to [min, max], or the
 * existing value clamped when the field was left empty/invalid.
 */
export function commitValue(text: string, fallback: number, min: number, max: number): number {
  const n = Number(text);
  if (text.trim() === '' || !Number.isFinite(n)) return clampNumber(fallback, min, max);
  return clampNumber(n, min, max);
}
