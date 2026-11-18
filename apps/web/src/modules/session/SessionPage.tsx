import type { ReactElement } from 'react';
import { Link } from 'react-router';
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

function ProgressHeader({ progress }: { readonly progress: SessionProgress }): ReactElement {
  return (
    <header className="flex items-center justify-between gap-3">
      <Link
        to="/"
        className="inline-flex h-11 items-center justify-center rounded-md px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:h-9"
      >
        Keluar
      </Link>
      <p className="flex flex-wrap items-center justify-end gap-x-1.5 text-xs text-muted-foreground">
        <span>{`Bagian ${String(progress.activityIndex + 1)} dari ${String(progress.activityCount)}`}</span>
        <span aria-hidden="true">·</span>
        <span>{activityLabel(progress.activityKind)}</span>
        <span aria-hidden="true">·</span>
        <span>{`Sisa ${String(progress.remaining)}`}</span>
      </p>
    </header>
  );
}

function SessionEnd({ title, message }: { readonly title: string; readonly message: string }): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={TYPOGRAPHY.pageTitle}>{title}</h1>
      <p className="text-sm">{message}</p>
      <Link
        to="/"
        className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:h-9 md:w-auto md:self-start"
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
      return <SessionEnd title="Sesi hari ini" message="Tidak ada yang perlu dilatih sekarang." />;
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
        />
      );
    default:
      return step satisfies never;
  }
}

function SessionView(): ReactElement {
  const runner = useSession();
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-6 px-4 py-8">
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
