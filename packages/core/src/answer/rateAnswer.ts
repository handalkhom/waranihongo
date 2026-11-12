import { RATING } from '../domain';
import type { Rating } from '../domain';
import {
  RATE_CHOICE_GOOD_MAX_MS,
  RATE_TYPED_EASY_MAX_MS,
  RATE_TYPED_GOOD_MAX_MS,
} from '../session/defaults';

export type AnswerMode = 'choice' | 'typed';

export function rateAnswer(input: {
  readonly correct: boolean;
  readonly elapsedMs: number;
  readonly mode: AnswerMode;
}): Rating {
  if (!input.correct) return RATING.again;
  if (input.mode === 'choice') {
    return input.elapsedMs <= RATE_CHOICE_GOOD_MAX_MS ? RATING.good : RATING.hard;
  }
  if (input.elapsedMs <= RATE_TYPED_EASY_MAX_MS) return RATING.easy;
  return input.elapsedMs <= RATE_TYPED_GOOD_MAX_MS ? RATING.good : RATING.hard;
}
