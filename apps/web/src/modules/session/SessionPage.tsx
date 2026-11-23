import type { ReactElement } from 'react';
import { Link } from 'react-router';
import { X } from 'lucide-react';
import type { SessionActivityKind } from '@wara/core';
import { PageLoader } from '@/components/PageLoader';
import { TYPOGRAPHY } from '@/lib/typography';
import { ContrastDrill, KanaIntroCard } from '@/modules/kana';
import { SessionDrillView } from './SessionDrill';
import { SessionProvider } from './SessionProvider';
import { useSession } from './useSession';
import type { SessionProgress, SessionRunner } from './useSessionRunner';

function activityLabel(kind: SessionActivityKind): string {
  switch (kind) {
    case 'review':
      return 'Ulangan';
    case 'new':
      return 'Huruf baru';
    case 'production':
      return 'Latihan';
    default:
      return kind satisfies never;
  }
}

function segmentClass(index: number, current: number): string {
  if (index < current) return 'h-2 flex-1 rounded-sm border border-primary bg-primary';
  if (index === current) return 'h-2 flex-1 rounded-sm border border-primary bg-primary/40';
  return 'h-2 flex-1 rounded-sm border border-border bg-card';
}

function ProgressHeader({ progress }: { readonly progress: SessionProgress }): ReactElement {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/"
          className="-ml-2 inline-flex h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:h-9"
        >
          <X aria-hidden="true" className="size-4" />
          Keluar
        </Link>
        <p className="flex flex-wrap items-center justify-end gap-x-1.5 text-xs text-muted-foreground">
          <span>{`Bagian ${String(progress.activityIndex + 1)} dari ${String(progress.activityCount)}`}</span>
          <span aria-hidden="true">·</span>
          <span className="font-medium text-accent-foreground">{activityLabel(progress.activityKind)}</span>
          <span aria-hidden="true">·</span>
          <span>{`Sisa ${String(progress.remaining)}`}</span>
        </p>
      </div>
      <div aria-hidden="true" className="flex gap-1">
        {Array.from({ length: progress.activityCount }, (_, index) => (
          <div key={index} className={segmentClass(index, progress.activityIndex)} />
        ))}
      </div>
    </header>
  );
}

function SessionEnd({
  title,
  message,
  stamped,
}: {
  readonly title: string;
  readonly message: string;
  readonly stamped: boolean;
}): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      {stamped && (
        <div
          aria-hidden="true"
          className="flex size-14 -rotate-3 items-center justify-center rounded-md border-2 border-primary text-primary"
        >
          <span lang="ja" className="text-3xl font-bold">
            済
          </span>
        </div>
      )}
      <h1 className={TYPOGRAPHY.pageTitle}>{title}</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Link
        to="/"
        className="inline-flex h-12 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:h-10 md:w-auto md:self-start"
      >
        Kembali ke Beranda
      </Link>
    </div>
  );
}

function SessionStepView({ runner }: { readonly runner: SessionRunner }): ReactElement {
  const { step } = runner;
  switch (step.kind) {
    case 'loading':
      return <PageLoader />;
    case 'empty':
      return <SessionEnd title="Sesi hari ini" message="Tidak ada yang perlu dilatih sekarang." stamped={false} />;
    case 'intro':
      return <KanaIntroCard item={step.item} onDone={runner.finishIntro} />;
    case 'drill':
      return (
        <div className="flex flex-col gap-4">
          {step.failedAttempts > 0 && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              Jawaban gagal disimpan. Coba jawab lagi.
            </p>
          )}
          <SessionDrillView
            key={`${step.drill.item.id}:${String(step.turn)}:${String(step.failedAttempts)}`}
            drill={step.drill}
            kana={runner.kana}
            onAnswer={(answer) => {
              void runner.answer(answer);
            }}
          />
        </div>
      );
    case 'contrast':
      return (
        <ContrastDrill
          key={`${step.target.id}:${step.partner.id}`}
          target={step.target}
          partner={step.partner}
          rng={Math.random}
          onDone={runner.finishContrast}
        />
      );
    case 'done':
      return (
        <SessionEnd
          title="Sesi selesai"
          message={`${String(step.answered)} jawaban, ${String(step.correct)} benar.`}
          stamped
        />
      );
    default:
      return step satisfies never;
  }
}

function SessionView(): ReactElement {
  const runner = useSession();
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-6 px-4 py-6 md:py-8">
      {runner.progress !== null && <ProgressHeader progress={runner.progress} />}
      <SessionStepView runner={runner} />
    </main>
  );
}

export function SessionPage(): ReactElement {
  return (
    <SessionProvider>
      <SessionView />
    </SessionProvider>
  );
}
