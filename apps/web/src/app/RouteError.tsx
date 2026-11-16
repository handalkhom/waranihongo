import { useEffect, type ReactElement } from 'react';
import { useRouteError } from 'react-router';
import { TYPOGRAPHY } from '@/lib/typography';

export function RouteError(): ReactElement {
  const error = useRouteError();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-3 px-4">
      <h1 className={TYPOGRAPHY.pageTitle}>Terjadi kesalahan</h1>
      <p className="text-sm text-muted-foreground">Halaman ini gagal dimuat. Muat ulang untuk mencoba lagi.</p>
      <button
        type="button"
        onClick={() => {
          window.location.reload();
        }}
        className="h-11 self-start rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9"
      >
        Muat ulang
      </button>
    </main>
  );
}
