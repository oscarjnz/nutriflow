import { cn } from '@/lib/utils';

/**
 * NutriFlow brand mark: a leaf (nutrition) whose central vein curves like a
 * flow (the <5s logging promise). Drawn on a 64x64 grid so it scales cleanly
 * from a 16px favicon to a hero header. The leaf path is exported so the
 * Next-generated icon routes render the exact same mark.
 */
export const LEAF_PATH =
  'M33 7 C 18 14, 11 33, 21 52 C 24 43, 30 38, 43 33 C 55 24, 49 12, 33 7 Z';
export const VEIN_PATH = 'M22 50 C 28 38, 34 31, 46 26';

export const BRAND_NAME = 'NutriFlow';

/** Just the icon: a rounded sage badge with the white leaf mark. */
export function LogoMark({ className, rounded = true }: { className?: string; rounded?: boolean }) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={BRAND_NAME}
      className={cn('h-8 w-8', className)}
    >
      <rect
        width="64"
        height="64"
        rx={rounded ? 16 : 0}
        fill="var(--color-primary)"
      />
      <path d={LEAF_PATH} fill="var(--color-primary-foreground)" />
      <path
        d={VEIN_PATH}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth={3}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Icon + wordmark, for headers and the sign-in/onboarding screens. */
export function Logo({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className={markClassName} />
      <span className="text-xl font-semibold tracking-tight">{BRAND_NAME}</span>
    </span>
  );
}
