/**
 * Open Food Facts attribution. The ODbL license under which OFF publishes its
 * data requires crediting the source when the data is reused. Kept as a small,
 * unobtrusive line we can drop wherever OFF-sourced products are shown.
 */
export function OffAttribution({ className }: { className?: string }) {
  return (
    <p className={`text-[var(--color-muted-foreground)] text-xs ${className ?? ''}`}>
      Datos de productos por{' '}
      <a
        href="https://world.openfoodfacts.org"
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2 hover:text-[var(--color-foreground)]"
      >
        Open Food Facts
      </a>
      , bajo licencia ODbL.
    </p>
  );
}
