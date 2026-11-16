import type { ReactElement } from 'react';

export function PageLoader(): ReactElement {
  return (
    <div role="status" aria-live="polite" className="flex min-h-svh items-center justify-center px-4">
      <span className="text-sm text-muted-foreground">Memuat…</span>
    </div>
  );
}
