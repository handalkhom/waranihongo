import type { ReactElement } from 'react';
import { House, Settings } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';

const NAV_LINK_CLASS =
  'flex h-14 flex-1 flex-col items-center justify-center gap-1 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:font-medium aria-[current=page]:text-foreground lg:h-9 lg:flex-none lg:flex-row lg:justify-start lg:gap-3 lg:rounded-md lg:px-3 lg:text-sm';

export function AppLayout(): ReactElement {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <nav
        aria-label="Navigasi utama"
        className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-background pb-[env(safe-area-inset-bottom)] lg:sticky lg:top-0 lg:h-dvh lg:w-56 lg:shrink-0 lg:flex-col lg:gap-1 lg:border-t-0 lg:border-r lg:p-3"
      >
        <NavLink to="/" end className={NAV_LINK_CLASS}>
          <House aria-hidden="true" className="size-5 lg:size-4" />
          Beranda
        </NavLink>
        <NavLink to="/pengaturan" className={NAV_LINK_CLASS}>
          <Settings aria-hidden="true" className="size-5 lg:size-4" />
          Pengaturan
        </NavLink>
      </nav>
      <main className="min-w-0 flex-1 pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <div className="mx-auto w-full max-w-2xl px-4 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
