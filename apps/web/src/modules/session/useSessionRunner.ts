import { useCallback, useEffect, useRef, useState } from 'react';
import { contentBundle } from '@wara/content';
import type { DataItem, KanaData, KanaItem, VocabItem } from '@wara/content/schema';
import {
  advanceSession,
  chooseDrill,
  ContentValidationError,
  derivePhase,
  DRILL_CHOICE_COUNT,
  gradeAnswer,
  needsIntro,
  pickChoices,
  planSession,
  RepositoryError,
  resumeSession,
  type DrillChoice,
  type LocalDate,
  type Repository,
  type ReviewState,
  type Session,
  type SessionActivityKind,
  type UserProfile,
} from '@wara/core';
import { useRepository } from '@/data/repositoryContext';
import { useSettings } from '@/hooks/useSettings';
import type { KanaDrillAnswer } from '@/modules/kana';
import { toLocalDate } from '@/utils/localDate';

export type SessionDrill =
  | { readonly kind: 'kana-to-romaji'; readonly item: KanaItem; readonly answerMode: 'choice'; readonly choices: ReadonlyArray<KanaItem> }
  | { readonly kind: 'kana-to-romaji'; readonly item: KanaItem; readonly answerMode: 'typed' }
  | { readonly kind: 'romaji-to-kana'; readonly item: KanaItem; readonly choices: ReadonlyArray<KanaItem> }
  | { readonly kind: 'dictation'; readonly item: KanaItem; readonly choices: ReadonlyArray<KanaItem> }
  | { readonly kind: 'word-reading'; readonly item: VocabItem };

export type SessionStep =
  | { readonly kind: 'loading' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'intro'; readonly item: KanaItem }
  | { readonly kind: 'drill'; readonly drill: SessionDrill; readonly turn: number; readonly failedAttempts: number }
  | { readonly kind: 'contrast'; readonly target: KanaItem; readonly partner: KanaItem }
  | { readonly kind: 'done'; readonly answered: number; readonly correct: number };

export interface SessionProgress {
  readonly activityIndex: number;
  readonly activityCount: number;
  readonly activityKind: SessionActivityKind;
  readonly remaining: number;
}

export interface SessionRunner {
  readonly step: SessionStep;
  readonly progress: SessionProgress | null;
  readonly kana: ReadonlyArray<KanaData>;
  readonly answer: (answer: KanaDrillAnswer) => Promise<void>;
  readonly finishIntro: () => void;
  readonly finishContrast: () => void;
}

interface Run {
  readonly session: Session;
  readonly queue: ReadonlyArray<string>;
  readonly states: ReadonlyMap<string, ReviewState>;
  readonly answered: number;
  readonly correct: number;
  readonly turn: number;
}

type Phase =
  | { readonly kind: 'loading' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'intro'; readonly run: Run; readonly item: KanaItem; readonly next: Phase }
  | { readonly kind: 'drill'; readonly run: Run; readonly drill: SessionDrill; readonly failedAttempts: number }
  | { readonly kind: 'contrast'; readonly run: Run; readonly target: KanaItem; readonly partner: KanaItem; readonly next: Phase }
  | { readonly kind: 'done'; readonly answered: number; readonly correct: number }
  | { readonly kind: 'failed'; readonly error: unknown };

interface Committed {
  readonly run: Run;
  readonly confusedWith: string | null;
}

const ALL_IDS: ReadonlyArray<string> = contentBundle.items.map((item) => item.id);
const ITEM_BY_ID: ReadonlyMap<string, DataItem> = new Map(contentBundle.items.map((item) => [item.id, item]));
const KANA_ITEMS: ReadonlyArray<KanaItem> = contentBundle.items.flatMap((item) => (item.type === 'kana' ? [item] : []));
const KANA_BY_ID: ReadonlyMap<string, KanaItem> = new Map(KANA_ITEMS.map((item) => [item.id, item]));
const KANA: ReadonlyArray<KanaData> = KANA_ITEMS.map((item) => item.data);

const statesById = (states: ReadonlyArray<ReviewState>): ReadonlyMap<string, ReviewState> =>
  new Map(states.map((state) => [state.itemId, state]));

function kanaDrill(item: KanaItem, choice: DrillChoice): SessionDrill {
  switch (choice.kind) {
    case 'kana-to-romaji':
      return choice.answerMode === 'typed'
        ? { kind: 'kana-to-romaji', item, answerMode: 'typed' }
        : {
            kind: 'kana-to-romaji',
            item,
            answerMode: 'choice',
            choices: pickChoices({
              item,
              items: contentBundle.items,
              groups: contentBundle.confusionGroups,
              count: DRILL_CHOICE_COUNT.kanaToRomaji,
              rng: Math.random,
            }),
          };
    case 'romaji-to-kana':
    case 'dictation':
      return {
        kind: choice.kind,
        item,
        choices: pickChoices({
          item,
          items: contentBundle.items,
          groups: contentBundle.confusionGroups,
          count: DRILL_CHOICE_COUNT.kanaGrid,
          rng: Math.random,
        }),
      };
    case 'word-reading':
      throw new ContentValidationError([{ path: item.id, message: 'latihan word-reading tidak cocok untuk kana' }]);
    default:
      return choice satisfies never;
  }
}

function vocabDrill(item: VocabItem, choice: DrillChoice): SessionDrill {
  if (choice.kind !== 'word-reading') {
    throw new ContentValidationError([{ path: item.id, message: `latihan ${choice.kind} tidak cocok untuk kosakata` }]);
  }
  return { kind: 'word-reading', item };
}

function drillPhase(run: Run, item: DataItem, state: ReviewState | null, activity: SessionActivityKind): Phase {
  const choice = chooseDrill({ item, state, activity, rng: Math.random });
  const nextRun: Run = { ...run, turn: run.turn + 1 };
  switch (item.type) {
    case 'kana':
      return { kind: 'drill', run: nextRun, drill: kanaDrill(item, choice), failedAttempts: 0 };
    case 'vocab':
      return { kind: 'drill', run: nextRun, drill: vocabDrill(item, choice), failedAttempts: 0 };
    default:
      return item satisfies never;
  }
}

function present(run: Run): Phase {
  const [head] = run.queue;
  const activity = run.session.activities[run.session.cursor];
  if (run.session.completed || head === undefined || activity === undefined) {
    return { kind: 'done', answered: run.answered, correct: run.correct };
  }
  const item = ITEM_BY_ID.get(head);
  if (item === undefined) {
    throw new ContentValidationError([{ path: head, message: 'item sesi tidak ada di konten' }]);
  }
  const state = run.states.get(head) ?? null;
  const drill = drillPhase(run, item, state, activity.kind);
  return item.type === 'kana' && needsIntro({ item, state, activity: activity.kind })
    ? { kind: 'intro', run, item, next: drill }
    : drill;
}

async function plannedSession({
  repository,
  profile,
  states,
  sessionsToday,
  now,
  today,
}: {
  readonly repository: Repository;
  readonly profile: UserProfile;
  readonly states: ReadonlyArray<ReviewState>;
  readonly sessionsToday: ReadonlyArray<Session>;
  readonly now: Date;
  readonly today: LocalDate;
}): Promise<Session | null> {
  const plan = planSession({
    availableMin: profile.dailyTargetMin,
    items: contentBundle.items,
    states,
    profile,
    phase: derivePhase({ assessments: await repository.getAssessments() }),
    sessionsToday,
    now,
    today,
    rng: Math.random,
  });
  if (plan.activities.length === 0) return null;
  return {
    id: crypto.randomUUID(),
    date: today,
    plannedMin: plan.plannedMin,
    actualMin: 0,
    activities: plan.activities,
    cursor: 0,
    completed: false,
  };
}

async function openSession(repository: Repository, profile: UserProfile): Promise<Phase> {
  const now = new Date();
  const today = toLocalDate(now);
  const states = await repository.getReviewStates(ALL_IDS);
  const sessionsToday = await repository.getSessions(today);
  const stored = sessionsToday.find((session) => !session.completed);
  const session = stored ?? (await plannedSession({ repository, profile, states, sessionsToday, now, today }));
  if (session === null) return { kind: 'empty' };
  const resumed = resumeSession({ session, states, now });
  if (resumed.session !== stored) await repository.saveSession(resumed.session);
  return present({
    session: resumed.session,
    queue: resumed.queue,
    states: statesById(states),
    answered: 0,
    correct: 0,
    turn: 0,
  });
}

async function commitAnswer(
  repository: Repository,
  run: Run,
  given: KanaDrillAnswer,
  weakSeeds: ReadonlyArray<string>,
): Promise<Committed> {
  const fresh = await repository.getReviewStates(ALL_IDS);
  const graded = gradeAnswer({
    itemId: given.itemId,
    correct: given.correct,
    given: given.given,
    elapsedMs: given.elapsedMs,
    states: fresh,
    groups: contentBundle.confusionGroups,
    items: contentBundle.items,
    weakSeeds,
    now: new Date(),
    logId: crypto.randomUUID(),
  });
  const next = advanceSession({
    session: run.session,
    queue: run.queue,
    correct: given.correct,
    elapsedMs: given.elapsedMs,
  });
  await repository.commitReview(graded.states, [graded.log], next.session);
  return {
    run: {
      ...run,
      session: next.session,
      queue: next.queue,
      states: statesById([...fresh, ...graded.states]),
      answered: run.answered + 1,
      correct: run.correct + (given.correct ? 1 : 0),
    },
    confusedWith: graded.confusedWith,
  };
}

async function resumeRun(repository: Repository, run: Run): Promise<Run> {
  const states = await repository.getReviewStates(ALL_IDS);
  const resumed = resumeSession({ session: run.session, states, now: new Date() });
  if (resumed.session !== run.session) await repository.saveSession(resumed.session);
  return { ...run, session: resumed.session, queue: resumed.queue, states: statesById(states) };
}

async function continueRun(repository: Repository, { run, confusedWith }: Committed, itemId: string): Promise<Phase> {
  const next = run.session.completed || run.queue.length > 0 ? run : await resumeRun(repository, run);
  const target = KANA_BY_ID.get(itemId);
  const partner = confusedWith === null ? undefined : KANA_BY_ID.get(confusedWith);
  if (target === undefined || partner === undefined) return present(next);
  return { kind: 'contrast', run: next, target, partner, next: present(next) };
}

const failAttempt = (phase: Phase): Phase =>
  phase.kind === 'drill' ? { ...phase, failedAttempts: phase.failedAttempts + 1 } : phase;

function stepOf(phase: Phase): SessionStep {
  switch (phase.kind) {
    case 'loading':
    case 'empty':
    case 'done':
      return phase;
    case 'intro':
      return { kind: 'intro', item: phase.item };
    case 'drill':
      return { kind: 'drill', drill: phase.drill, turn: phase.run.turn, failedAttempts: phase.failedAttempts };
    case 'contrast':
      return { kind: 'contrast', target: phase.target, partner: phase.partner };
    case 'failed':
      throw phase.error;
    default:
      return phase satisfies never;
  }
}

function progressOf(phase: Phase): SessionProgress | null {
  switch (phase.kind) {
    case 'intro':
    case 'drill':
    case 'contrast': {
      const { session, queue } = phase.run;
      const activity = session.activities[session.cursor];
      return activity === undefined
        ? null
        : {
            activityIndex: session.cursor,
            activityCount: session.activities.length,
            activityKind: activity.kind,
            remaining: queue.length,
          };
    }
    case 'loading':
    case 'empty':
    case 'done':
    case 'failed':
      return null;
    default:
      return phase satisfies never;
  }
}

export function useSessionRunner(): SessionRunner {
  const repository = useRepository();
  const settings = useSettings();
  const profile = settings.status === 'ready' ? settings.profile : null;
  const opened = useRef(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });

  useEffect(() => {
    if (profile === null || opened.current) return;
    opened.current = true;
    openSession(repository, profile).then(setPhase, (error: unknown) => {
      setPhase({ kind: 'failed', error });
    });
  }, [profile, repository]);

  const answer = useCallback(
    async (given: KanaDrillAnswer): Promise<void> => {
      if (phase.kind !== 'drill' || profile === null) return;
      const committed = await commitAnswer(repository, phase.run, given, profile.weakSeeds).catch(
        (error: unknown): null => {
          setPhase(error instanceof RepositoryError ? failAttempt : { kind: 'failed', error });
          return null;
        },
      );
      if (committed === null) return;
      setPhase(
        await continueRun(repository, committed, given.itemId).catch(
          (error: unknown): Phase => ({ kind: 'failed', error }),
        ),
      );
    },
    [phase, profile, repository],
  );

  const finishIntro = useCallback((): void => {
    if (phase.kind === 'intro') setPhase(phase.next);
  }, [phase]);

  const finishContrast = useCallback((): void => {
    if (phase.kind === 'contrast') setPhase(phase.next);
  }, [phase]);

  return { step: stepOf(phase), progress: progressOf(phase), kana: KANA, answer, finishIntro, finishContrast };
}
