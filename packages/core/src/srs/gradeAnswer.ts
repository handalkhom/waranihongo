import type { ConfusionGroup, ContentItem } from '@wara/content/schema';
import { rateAnswer } from '../answer/rateAnswer';
import type { ReviewLog, ReviewState } from '../domain';
import { applyConfusion, type ConfusionAnswer, type ConfusionResult } from './applyConfusion';
import { schedule } from './schedule';

export interface GradedAnswer {
  readonly states: ReadonlyArray<ReviewState>;
  readonly log: ReviewLog;
  readonly confusedWith: string | null;
  readonly priorityNew: ReadonlyArray<string>;
}

export function gradeAnswer({
  itemId,
  correct,
  given,
  elapsedMs,
  states,
  groups,
  items,
  weakSeeds,
  now,
  logId,
}: {
  readonly itemId: string;
  readonly correct: boolean;
  readonly given: ConfusionAnswer;
  readonly elapsedMs: number;
  readonly states: ReadonlyArray<ReviewState>;
  readonly groups: ReadonlyArray<ConfusionGroup>;
  readonly items: ReadonlyArray<ContentItem>;
  readonly weakSeeds: ReadonlyArray<string>;
  readonly now: Date;
  readonly logId: string;
}): GradedAnswer {
  const rating = rateAnswer({ correct, elapsedMs, mode: given.mode });
  const confusion: ConfusionResult = correct
    ? { confusedWith: null, moved: [], priorityNew: [] }
    : applyConfusion({ itemId, given, groups, items, states, now });
  return {
    states: [
      schedule({ itemId, state: states.find((state) => state.itemId === itemId) ?? null, rating, now, weakSeeds }),
      ...confusion.moved,
    ],
    log: { id: logId, itemId, at: now, rating, elapsedMs, confusedWith: confusion.confusedWith },
    confusedWith: confusion.confusedWith,
    priorityNew: confusion.priorityNew,
  };
}
