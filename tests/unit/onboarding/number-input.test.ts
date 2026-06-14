import { describe, expect, it } from 'vitest';

import { clampNumber, commitValue, liveValue } from '@/features/onboarding/number-input';

describe('liveValue', () => {
  it('ignores empty / whitespace so the field can be cleared while typing', () => {
    expect(liveValue('')).toBeNull();
    expect(liveValue('   ')).toBeNull();
  });

  it('ignores partial / non-numeric input', () => {
    expect(liveValue('-')).toBeNull();
    expect(liveValue('abc')).toBeNull();
  });

  it('does NOT clamp - intermediate values below the minimum are allowed', () => {
    // The bug: typing "2" on the way to "25" used to snap to the min (14/100).
    expect(liveValue('2')).toBe(2);
    expect(liveValue('1')).toBe(1);
  });

  it('keeps decimals so weight in kg can be typed', () => {
    expect(liveValue('68.5')).toBe(68.5);
  });
});

describe('commitValue (blur)', () => {
  it('clamps the typed number into range', () => {
    expect(commitValue('2', 30, 14, 100)).toBe(14);
    expect(commitValue('500', 30, 14, 100)).toBe(100);
    expect(commitValue('25', 30, 14, 100)).toBe(25);
  });

  it('falls back to the current value (clamped) when left empty or invalid', () => {
    expect(commitValue('', 25, 14, 100)).toBe(25);
    expect(commitValue('  ', 25, 14, 100)).toBe(25);
    expect(commitValue('abc', 25, 14, 100)).toBe(25);
  });

  it('clamps the fallback too if it is out of range', () => {
    expect(commitValue('', 5, 14, 100)).toBe(14);
  });
});

describe('clampNumber', () => {
  it('bounds to [min, max]', () => {
    expect(clampNumber(50, 14, 100)).toBe(50);
    expect(clampNumber(5, 14, 100)).toBe(14);
    expect(clampNumber(150, 14, 100)).toBe(100);
  });
});
