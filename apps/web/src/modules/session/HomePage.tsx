import type { ReactElement } from 'react';
import { Link } from 'react-router';
import { PageLoader } from '@/components/PageLoader';
import { TYPOGRAPHY } from '@/lib/typography';
import { useHome, type HomeToday } from './useHome';

function SessionLink({ label }: { readonly label: string }): ReactElement {
  return (
    <Link
      to="/sesi"
      className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:h-9 md:w-auto md:self-start"
    >
      {label}
    </Link>
  );
}

function TodayAction({ today }: { readonly today: HomeToday }): ReactElement {
  switch (today) {
    case 'unfinished':
      return <SessionLink label="Lanjutkan sesi" />;
    case 'completed':
      return (
        <div className="flex flex-col gap-3">
          <p className="text-sm">Sesi hari ini selesai.</p>
          <SessionLink label="Mulai sesi lagi" />
        </div>
      );
    case 'none':
      return <SessionLink label="Mulai sesi hari ini" />;
    default:
      return today satisfies never;
  }
}

export function HomePage(): ReactElement {
  const home = useHome();
  if (home.status === 'loading') {
    return <PageLoader />;
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className={TYPOGRAPHY.pageTitle}>Beranda</h1>
        <p className="text-sm text-muted-foreground">Halo, {home.name}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <p className="rounded-lg border border-border p-4 text-sm">
          <span className="font-semibold">{home.streakDays}</span> hari berturut-turut
        </p>
        <p className="rounded-lg border border-border p-4 text-sm">
          Perlu diulang: <span className="font-semibold">{home.dueCount}</span>
        </p>
      </div>
      <TodayAction today={home.today} />
    </div>
  );
}
