import type { ReactElement } from 'react';
import { TYPOGRAPHY } from '@/lib/typography';

export function SettingsPage(): ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <h1 className={TYPOGRAPHY.pageTitle}>Pengaturan</h1>
      <p className="text-sm text-muted-foreground">Pengaturan sedang dibangun.</p>
    </div>
  );
}
