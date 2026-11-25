import { useEffect, useId, useState, type ReactElement } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { X } from 'lucide-react';
import { contentBundle } from '@wara/content';
import type { KanaData, VocabItem } from '@wara/content/schema';
import { KANA_EXIT_TIME_LIMIT_MS, romanize, type KanaExitAssessment } from '@wara/core';
import { PageLoader } from '@/components/PageLoader';
import { TYPOGRAPHY } from '@/lib/typography';
import { useKanaExit, type KanaExitRunner } from './useKanaExit';

const KANA: ReadonlyArray<KanaData> = contentBundle.items.flatMap((item) => (item.type === 'kana' ? [item.data] : []));

const PRIMARY_LINK =
  'inline-flex h-12 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:h-10 md:w-auto md:self-start';

function minutesSeconds(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;
}

function BackHome(): ReactElement {
  return (
    <Link to="/" className={PRIMARY_LINK}>
      Kembali ke Beranda
    </Link>
  );
}

function Notice({ message }: { readonly message: string }): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={TYPOGRAPHY.pageTitle}>Tes keluar Fase 0</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      <BackHome />
    </div>
  );
}

function TestHeader({
  index,
  total,
  shownMs,
}: {
  readonly index: number;
  readonly total: number;
  readonly shownMs: number;
}): ReactElement {
  return (
    <header className="flex items-center justify-between gap-3">
      <Link
        to="/"
        className="-ml-2 inline-flex h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:h-9"
      >
        <X aria-hidden="true" className="size-4" />
        Keluar
      </Link>
      <p className="flex flex-wrap items-center justify-end gap-x-1.5 text-xs text-muted-foreground">
        <span>{`Kata ${String(index + 1)} dari ${String(total)}`}</span>
        <span aria-hidden="true">·</span>
        <span className="font-medium text-accent-foreground">
          {`Waktu tampil ${minutesSeconds(shownMs)} / ${minutesSeconds(KANA_EXIT_TIME_LIMIT_MS)}`}
        </span>
      </p>
    </header>
  );
}

function ShowingHeader({
  index,
  total,
  displayedMs,
  shownAt,
}: {
  readonly index: number;
  readonly total: number;
  readonly displayedMs: number;
  readonly shownAt: number;
}): ReactElement {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 250);
    return () => {
      clearInterval(timer);
    };
  }, []);
  return <TestHeader index={index} total={total} shownMs={displayedMs + (now - shownAt)} />;
}

function RomajiForm({
  failedAttempts,
  onSubmit,
}: {
  readonly failedAttempts: number;
  readonly onSubmit: (text: string) => void;
}): ReactElement {
  const inputId = useId();
  const [text, setText] = useState('');
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(text);
      }}
    >
      <label htmlFor={inputId} className="text-sm font-medium">
        Romaji kata tadi
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          type="text"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
          autoFocus
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="h-11 min-w-0 flex-1 rounded-md border border-border bg-card px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:h-9 md:text-sm"
        />
        <button
          type="submit"
          disabled={text.trim() === ''}
          className="h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 md:h-9"
        >
          Kirim
        </button>
      </div>
      {failedAttempts > 0 && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Jawaban gagal disimpan. Coba kirim lagi.
        </p>
      )}
    </form>
  );
}

function WrongWords({ words }: { readonly words: ReadonlyArray<VocabItem> }): ReactElement {
  return (
    <section className="flex flex-col gap-3">
      <h2 className={TYPOGRAPHY.sectionTitle}>Kata yang salah</h2>
      <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-card">
        {words.map((word) => (
          <li key={word.id} className="flex items-baseline justify-between gap-3 px-4 py-3">
            <span lang="ja" className="text-2xl font-medium">
              {word.data.word}
            </span>{' '}
            <span className="text-sm text-muted-foreground">
              {romanize({ reading: word.data.reading, kana: KANA })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Result({
  assessment,
  wrongWords,
}: {
  readonly assessment: KanaExitAssessment;
  readonly wrongWords: ReadonlyArray<VocabItem>;
}): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={TYPOGRAPHY.pageTitle}>{assessment.passed ? 'Lulus' : 'Belum lulus'}</h1>
      <p className="text-sm">
        {`${String(assessment.correct)} dari ${String(assessment.total)} benar, waktu tampil ${minutesSeconds(assessment.elapsedMs)}.`}
      </p>
      {assessment.passed && <p className="text-sm font-medium text-accent-foreground">Fase 1 terbuka.</p>}
      {assessment.elapsedMs > KANA_EXIT_TIME_LIMIT_MS && (
        <p className="text-sm text-muted-foreground">
          {`Waktu tampil melebihi ${minutesSeconds(KANA_EXIT_TIME_LIMIT_MS)}.`}
        </p>
      )}
      {wrongWords.length > 0 && <WrongWords words={wrongWords} />}
      <BackHome />
    </div>
  );
}

function KanaExitStepView({ runner }: { readonly runner: KanaExitRunner }): ReactElement {
  const { step } = runner;
  switch (step.kind) {
    case 'loading':
      return <PageLoader />;
    case 'locked':
      return <Notice message="Tes ini terbuka setelah setiap kana pernah diulang sekali." />;
    case 'passed':
      return <Notice message="Kamu sudah lulus tes ini." />;
    case 'showing':
      return (
        <>
          <ShowingHeader
            key={step.index}
            index={step.index}
            total={runner.total}
            displayedMs={runner.displayedMs}
            shownAt={step.shownAt}
          />
          <div className="flex flex-col gap-6">
            <p className="text-sm text-muted-foreground">Baca kata ini, lalu tekan Siap.</p>
            <p lang="ja" className="genko inline-flex self-center px-4 py-3 text-5xl font-medium leading-tight">
              {step.word.data.word}
            </p>
            <button
              type="button"
              onClick={runner.ready}
              className="h-12 w-full rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:h-10 md:w-auto md:self-center"
            >
              Siap
            </button>
          </div>
        </>
      );
    case 'typing':
      return (
        <>
          <TestHeader index={step.index} total={runner.total} shownMs={runner.displayedMs} />
          <RomajiForm
            key={step.index}
            failedAttempts={step.failedAttempts}
            onSubmit={(text) => {
              void runner.submit(text);
            }}
          />
        </>
      );
    case 'saving-failed':
      return (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-red-600 dark:text-red-400">Hasil tes gagal disimpan.</p>
          <button
            type="button"
            onClick={() => {
              void runner.retrySave();
            }}
            className="h-12 w-full rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:h-10 md:w-auto md:self-start"
          >
            Simpan lagi
          </button>
        </div>
      );
    case 'finished':
      return <Result assessment={step.assessment} wrongWords={step.wrongWords} />;
    default:
      return step satisfies never;
  }
}

function KanaExitTest(): ReactElement {
  const runner = useKanaExit();
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-6 px-4 py-6 md:py-8">
      <KanaExitStepView runner={runner} />
    </main>
  );
}

export function TestPage(): ReactElement {
  const { kind } = useParams();
  if (kind !== 'kana-exit') return <Navigate to="/" replace />;
  return <KanaExitTest />;
}
