import type { ConfusionAnswer } from '@wara/core';

export interface KanaDrillAnswer {
  readonly itemId: string;
  readonly correct: boolean;
  readonly given: ConfusionAnswer;
  readonly elapsedMs: number;
}
