import { useCallback, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { contentBundle } from '@wara/content';
import type { KanaData, KanaItem } from '@wara/content/schema';
import { gradeAnswer, placementItems, RepositoryError, weakSeedChoices, type RomajiAid } from '@wara/core';
import { useRepository } from '@/data/repositoryContext';
import type { KanaDrillAnswer } from '@/modules/kana';
import { toLocalDate } from '@/utils/localDate';

export type OnboardingSaving = 'idle' | 'saving' | 'failed';

export type OnboardingStep =
  | { readonly kind: 'loading' }
  | { readonly kind: 'profile' }
  | {
      readonly kind: 'test';
      readonly item: KanaItem;
      readonly position: number;
      readonly total: number;
      readonly failedAttempts: number;
    }
  | {
      readonly kind: 'finish';
      readonly seedChoices: ReadonlyArray<KanaItem>;
      readonly saving: OnboardingSaving;
    };

export interface OnboardingProfileInput {
  readonly name: string;
  readonly dailyTargetMin: number;
}

export interface OnboardingSaveInput {
  readonly weakSeeds: ReadonlyArray<string>;
  readonly romajiAid: RomajiAid;
}

export interface Onboarding {
  readonly step: OnboardingStep;
  readonly kana: ReadonlyArray<KanaData>;
  readonly start: (profile: OnboardingProfileInput) => void;
  readonly answer: (answer: KanaDrillAnswer) => Promise<void>;
  readonly skip: () => void;
  readonly save: (choice: OnboardingSaveInput) => Promise<void>;
}

type Phase =
  | { readonly kind: 'profile' }
  | {
      readonly kind: 'test';
      readonly profile: OnboardingProfileInput;
      readonly item: KanaItem;
      readonly rest: ReadonlyArray<KanaItem>;
      readonly position: number;
      readonly total: number;
      readonly failedAttempts: number;
    }
  | { readonly kind: 'finish'; readonly profile: OnboardingProfileInput; readonly saving: OnboardingSaving };

const KANA_ITEMS: ReadonlyArray<KanaItem> = contentBundle.items.flatMap((item) => (item.type === 'kana' ? [item] : []));
const KANA_IDS: ReadonlyArray<string> = KANA_ITEMS.map((item) => item.id);
const KANA: ReadonlyArray<KanaData> = KANA_ITEMS.map((item) => item.data);

const queuePhase = (
  profile: OnboardingProfileInput,
  queue: ReadonlyArray<KanaItem>,
  position: number,
  total: number,
): Phase => {
  const [item, ...rest] = queue;
  return item === undefined
    ? { kind: 'finish', profile, saving: 'idle' }
    : { kind: 'test', profile, item, rest, position, total, failedAttempts: 0 };
};

const advance = (phase: Phase): Phase =>
  phase.kind === 'test' ? queuePhase(phase.profile, phase.rest, phase.position + 1, phase.total) : phase;

const failAttempt = (phase: Phase): Phase =>
  phase.kind === 'test' ? { ...phase, failedAttempts: phase.failedAttempts + 1 } : phase;

const withSaving =
  (saving: OnboardingSaving) =>
  (phase: Phase): Phase =>
    phase.kind === 'finish' ? { ...phase, saving } : phase;

export const useOnboarding = (): Onboarding => {
  const repository = useRepository();
  const states = useLiveQuery(() => repository.getReviewStates(KANA_IDS), [repository]);
  const [phase, setPhase] = useState<Phase>({ kind: 'profile' });

  const start = useCallback(
    (profile: OnboardingProfileInput): void => {
      if (states === undefined) return;
      const queue = placementItems({ items: contentBundle.items, states, rng: Math.random });
      setPhase(queuePhase(profile, queue, 0, queue.length));
    },
    [states],
  );

  const answer = useCallback(
    async (given: KanaDrillAnswer): Promise<void> => {
      try {
        const graded = gradeAnswer({
          itemId: given.itemId,
          correct: given.correct,
          given: given.given,
          elapsedMs: given.elapsedMs,
          states: await repository.getReviewStates(KANA_IDS),
          groups: contentBundle.confusionGroups,
          items: contentBundle.items,
          weakSeeds: [],
          now: new Date(),
          logId: crypto.randomUUID(),
        });
        await repository.commitReview(graded.states, [graded.log]);
      } catch (error) {
        if (!(error instanceof RepositoryError)) throw error;
        setPhase(failAttempt);
        return;
      }
      setPhase(advance);
    },
    [repository],
  );

  const skip = useCallback((): void => {
    setPhase(advance);
  }, []);

  const save = useCallback(
    async (choice: OnboardingSaveInput): Promise<void> => {
      if (phase.kind !== 'finish') return;
      setPhase(withSaving('saving'));
      try {
        await repository.saveProfile({
          id: 'me',
          name: phase.profile.name,
          dailyTargetMin: phase.profile.dailyTargetMin,
          romajiAid: choice.romajiAid,
          theme: 'system',
          ttsVoiceUri: null,
          startDate: toLocalDate(new Date()),
          weakSeeds: choice.weakSeeds,
        });
      } catch (error) {
        if (!(error instanceof RepositoryError)) throw error;
        setPhase(withSaving('failed'));
      }
    },
    [phase, repository],
  );

  const step = ((): OnboardingStep => {
    if (states === undefined) return { kind: 'loading' };
    switch (phase.kind) {
      case 'profile':
        return phase;
      case 'test':
        return {
          kind: 'test',
          item: phase.item,
          position: phase.position,
          total: phase.total,
          failedAttempts: phase.failedAttempts,
        };
      case 'finish':
        return {
          kind: 'finish',
          seedChoices: weakSeedChoices({ seedIds: contentBundle.seed.items, items: contentBundle.items, states }),
          saving: phase.saving,
        };
      default:
        return phase satisfies never;
    }
  })();

  return { step, kana: KANA, start, answer, skip, save };
};
