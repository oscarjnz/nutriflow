'use client';

import { Download } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Triggers the browser's print dialog, which doubles as "Save as PDF" on every
 * platform. No PDF library needed (CLAUDE.md §3 cost constraint): print styles
 * on the record page produce a clean, logo-branded document.
 */
export function PrintButton({ label = 'Descargar PDF' }: { label?: string }) {
  return (
    <Button variant="outline" className="w-full print:hidden" onClick={() => window.print()}>
      <Download className="h-4 w-4" />
      {label}
    </Button>
  );
}
