import type { ReactElement } from 'react';
import { Link } from 'react-router';
import { KANA_EXIT_TIME_LIMIT_MS, KANA_EXIT_WORD_COUNT } from '@wara/core';
import { PageLoader } from '@/components/PageLoader';
import { TYPOGRAPHY } from '@/lib/typography';
import { useHome, type HomeToday } from './useHome';

function todaySubline(today: HomeToday): string {
  switch (today) {
    case 'unfinished':
      return 'Sesimu masih menunggu.';
    case 'completed':
      return 'Sesi hari ini selesai.';
    case 'none':
      return 'Siap latihan hari ini?';
    default:
      return today satisfies never;
  }
}

function todayLinkLabel(today: HomeToday): string {
  switch (today) {
    case 'unfinished':
      return 'Lanjutkan sesi';
    case 'completed':
      return 'Mulai sesi lagi';
    case 'none':
      return 'Mulai sesi hari ini';
    default:
      return today satisfies never;
  }
}

function SessionLink({ label }: { readonly label: string }): ReactElement {
  return (
    <Link
      to="/sesi"
      className="inline-flex h-12 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:h-10 md:w-auto md:self-start"
    >
      {label}
    </Link>
  );
}

function KanaExitCard(): ReactElement {
  return (
    <section className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
      <h2 className={TYPOGRAPHY.sectionTitle}>Tes keluar Fase 0</h2>
      <p className="text-sm text-muted-foreground">
        Baca {KANA_EXIT_WORD_COUNT} kata dalam kana tanpa salah, dengan total waktu tampil paling lama{' '}
        {KANA_EXIT_TIME_LIMIT_MS / 60_000} menit.
      </p>
      <Link
        to="/tes/kana-exit"
        className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card md:h-9 md:self-start"
      >
        Mulai tes
      </Link>
    </section>
  );
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
      <div className="flex items-center gap-5">
        <p className="flex size-24 shrink-0 -rotate-3 flex-col items-center justify-center gap-1 rounded-md border-2 border-primary bg-card px-2 text-center text-xs leading-tight text-primary">
          <span className="text-3xl font-bold leading-none tabular-nums">{home.streakDays}</span>{' '}
          hari berturut-turut
        </p>
        <p className="flex flex-col-reverse gap-0.5 text-sm text-muted-foreground">
          Perlu diulang:{' '}
          <span className="text-xl font-semibold tabular-nums text-foreground">{home.dueCount}</span>
        </p>
      </div>
      <p className="text-sm text-muted-foreground">{todaySubline(home.today)}</p>
      <SessionLink label={todayLinkLabel(home.today)} />
      {home.kanaExit === 'open' && <KanaExitCard />}
    </div>
  );
}
