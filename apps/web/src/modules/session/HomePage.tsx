import type { ReactElement } from 'react';
import { TYPOGRAPHY } from '@/lib/typography';

export function HomePage(): ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <h1 className={TYPOGRAPHY.pageTitle}>Beranda</h1>
      <p className="text-sm text-muted-foreground">Beranda sedang dibangun.</p>
    </div>
  );
}
