import { useCallback, useEffect, useRef, useState } from 'react';
import { contentBundle } from '@wara/content';
import type { KanaData, VocabItem } from '@wara/content/schema';
import {
  gradeAnswer,
  KANA_EXIT_WORD_COUNT,
  kanaExitAssessment,
  kanaExitGate,
  kanaExitWords,
  RepositoryError,
  romajiMatches,
  type KanaExitAssessment,
  type Repository,
} from '@wara/core';
import { useRepository } from '@/data/repositoryContext';
import { useSettings } from '@/hooks/useSettings';
import { toLocalDate } from '@/utils/localDate';

export type KanaExitStep =
  | { readonly kind: 'loading' }
  | { readonly kind: 'locked' }
  | { readonly kind: 'passed' }
  | {
      readonly kind: 'showing';
      readonly index: number;
      readonly word: VocabItem;
      readonly shownAt: number;
    }
  | {
      readonly kind: 'typing';
      readonly index: number;
      readonly word: VocabItem;
      readonly failedAttempts: number;
    }
  | { readonly kind: 'saving-failed' }
  | {
      readonly kind: 'finished';
      readonly assessment: KanaExitAssessment;
      readonly wrongWords: ReadonlyArray<VocabItem>;
    };

export interface KanaExitRunner {
  readonly step: KanaExitStep;
  readonly total: number;
  readonly displayedMs: number;
  readonly ready: () => void;
  readonly submit: (text: string) => Promise<void>;
  readonly retrySave: () => Promise<void>;
}

interface Run {
  readonly words: ReadonlyArray<VocabItem>;
  readonly answers: ReadonlyArray<{ readonly itemId: string; readonly correct: boolean }>;
  readonly displayedMs: number;
}

type Phase =
  | { readonly kind: 'loading' }
  | { readonly kind: 'locked' }
  | { readonly kind: 'passed' }
  | { readonly kind: 'showing'; readonly run: Run; readonly word: VocabItem; readonly shownAt: number }
  | {
      readonly kind: 'typing';
      readonly run: Run;
      readonly word: VocabItem;
      readonly elapsedMs: number;
      readonly failedAttempts: number;
    }
  | { readonly kind: 'saving-failed'; readonly words: ReadonlyArray<VocabItem>; readonly assessment: KanaExitAssessment }
  | { readonly kind: 'finished'; readonly assessment: KanaExitAssessment; readonly wrongWords: ReadonlyArray<VocabItem> }
  | { readonly kind: 'failed'; readonly error: unknown };

type TypingPhase = Extract<Phase, { readonly kind: 'typing' }>;

const ALL_IDS: ReadonlyArray<string> = contentBundle.items.map((item) => item.id);
const KANA: ReadonlyArray<KanaData> = contentBundle.items.flatMap((item) => (item.type === 'kana' ? [item.data] : []));

function saveResult(
  repository: Repository,
  words: ReadonlyArray<VocabItem>,
  assessment: KanaExitAssessment,
): Promise<Phase> {
  return repository.saveAssessment(assessment).then(
    (): Phase => ({
      kind: 'finished',
      assessment,
      wrongWords: assessment.wrong.flatMap((id) => words.filter((word) => word.id === id)),
    }),
    (error: unknown): Phase => {
      if (error instanceof RepositoryError) return { kind: 'saving-failed', words, assessment };
      throw error;
    },
  );
}

function advance(repository: Repository, run: Run): Promise<Phase> {
  const word = run.words[run.answers.length];
  if (word !== undefined) return Promise.resolve({ kind: 'showing', run, word, shownAt: Date.now() });
  return saveResult(
    repository,
    run.words,
    kanaExitAssessment({
      answers: run.answers,
      elapsedMs: run.displayedMs,
      id: crypto.randomUUID(),
      date: toLocalDate(new Date()),
    }),
  );
}

async function openTest(repository: Repository): Promise<Phase> {
  const gate = kanaExitGate({
    items: contentBundle.items,
    states: await repository.getReviewStates(ALL_IDS),
    assessments: await repository.getAssessments(),
  });
  if (gate !== 'open') return { kind: gate };
  return advance(repository, {
    words: kanaExitWords({ items: contentBundle.items, rng: Math.random }),
    answers: [],
    displayedMs: 0,
  });
}

async function answerWord(
  repository: Repository,
  { run, word, elapsedMs }: TypingPhase,
  text: string,
  weakSeeds: ReadonlyArray<string>,
): Promise<Run> {
  const correct = romajiMatches({ reading: word.data.reading, given: text, kana: KANA });
  const graded = gradeAnswer({
    itemId: word.id,
    correct,
    given: { mode: 'typed', text },
    elapsedMs,
    states: await repository.getReviewStates(ALL_IDS),
    groups: contentBundle.confusionGroups,
    items: contentBundle.items,
    weakSeeds,
    now: new Date(),
    logId: crypto.randomUUID(),
  });
  await repository.commitReview(graded.states, [graded.log]);
  return { ...run, answers: [...run.answers, { itemId: word.id, correct }] };
}

function stepOf(phase: Phase): KanaExitStep {
  switch (phase.kind) {
    case 'loading':
    case 'locked':
    case 'passed':
    case 'finished':
      return phase;
    case 'showing':
      return { kind: 'showing', index: phase.run.answers.length, word: phase.word, shownAt: phase.shownAt };
    case 'typing':
      return {
        kind: 'typing',
        index: phase.run.answers.length,
        word: phase.word,
        failedAttempts: phase.failedAttempts,
      };
    case 'saving-failed':
      return { kind: 'saving-failed' };
    case 'failed':
      throw phase.error;
    default:
      return phase satisfies never;
  }
}

function displayedOf(phase: Phase): number {
  switch (phase.kind) {
    case 'showing':
    case 'typing':
      return phase.run.displayedMs;
    case 'saving-failed':
    case 'finished':
      return phase.assessment.elapsedMs;
    case 'loading':
    case 'locked':
    case 'passed':
    case 'failed':
      return 0;
    default:
      return phase satisfies never;
  }
}

export function useKanaExit(): KanaExitRunner {
  const repository = useRepository();
  const settings = useSettings();
  const profile = settings.status === 'ready' ? settings.profile : null;
  const opened = useRef(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });

  useEffect(() => {
    if (profile === null || opened.current) return;
    opened.current = true;
    openTest(repository).then(setPhase, (error: unknown) => {
      setPhase({ kind: 'failed', error });
    });
  }, [profile, repository]);

  const ready = useCallback((): void => {
    if (phase.kind !== 'showing') return;
    const elapsedMs = Date.now() - phase.shownAt;
    setPhase({
      kind: 'typing',
      run: { ...phase.run, displayedMs: phase.run.displayedMs + elapsedMs },
      word: phase.word,
      elapsedMs,
      failedAttempts: 0,
    });
  }, [phase]);

  const submit = useCallback(
    async (text: string): Promise<void> => {
      if (phase.kind !== 'typing' || profile === null) return;
      const run = await answerWord(repository, phase, text, profile.weakSeeds).catch((error: unknown): null => {
        setPhase(
          error instanceof RepositoryError
            ? { ...phase, failedAttempts: phase.failedAttempts + 1 }
            : { kind: 'failed', error },
        );
        return null;
      });
      if (run === null) return;
      setPhase(await advance(repository, run).catch((error: unknown): Phase => ({ kind: 'failed', error })));
    },
    [phase, profile, repository],
  );

  const retrySave = useCallback(async (): Promise<void> => {
    if (phase.kind !== 'saving-failed') return;
    setPhase(
      await saveResult(repository, phase.words, phase.assessment).catch(
        (error: unknown): Phase => ({ kind: 'failed', error }),
      ),
    );
  }, [phase, repository]);

  return { step: stepOf(phase), total: KANA_EXIT_WORD_COUNT, displayedMs: displayedOf(phase), ready, submit, retrySave };
}
