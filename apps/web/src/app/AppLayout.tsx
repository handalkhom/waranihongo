import type { ReactElement } from 'react';
import { House, Settings } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';

const NAV_LINK_CLASS =
  'relative flex h-14 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground outline-none transition-colors before:absolute before:inset-x-3 before:top-0 before:h-0.5 before:rounded-b-sm before:bg-transparent hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-[current=page]:font-semibold aria-[current=page]:text-primary aria-[current=page]:before:bg-primary lg:h-9 lg:flex-none lg:flex-row lg:justify-start lg:gap-3 lg:rounded-md lg:px-3 lg:text-sm lg:before:hidden lg:aria-[current=page]:bg-accent lg:aria-[current=page]:text-accent-foreground';

export function AppLayout(): ReactElement {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <nav
        aria-label="Navigasi utama"
        className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:sticky lg:top-0 lg:h-dvh lg:w-56 lg:shrink-0 lg:flex-col lg:gap-1 lg:border-t-0 lg:border-r lg:px-3 lg:py-5"
      >
        <div className="mb-4 hidden items-center gap-3 px-1 lg:flex">
          <span
            aria-hidden="true"
            lang="ja"
            className="flex size-8 -rotate-3 items-center justify-center rounded-md border-2 border-primary bg-card text-base font-semibold text-primary"
          >
            わ
          </span>
          <p className="text-sm font-semibold text-foreground">Wara no Nihongo</p>
        </div>
        <NavLink to="/" end className={NAV_LINK_CLASS}>
          <House aria-hidden="true" className="size-5 lg:size-4" />
          Beranda
        </NavLink>
        <NavLink to="/pengaturan" className={NAV_LINK_CLASS}>
          <Settings aria-hidden="true" className="size-5 lg:size-4" />
          Pengaturan
        </NavLink>
      </nav>
      <main className="min-w-0 flex-1 pb-[calc(3.5rem+1px+env(safe-area-inset-bottom))] lg:pb-0">
        <div className="mx-auto w-full max-w-2xl px-4 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
