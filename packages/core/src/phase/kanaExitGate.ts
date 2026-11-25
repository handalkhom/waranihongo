import type { ContentItem } from '@wara/content/schema';
import type { Assessment, ReviewState } from '../domain';
import { isDrillableKana } from '../session/isDrillableKana';
import { kanaExitAvailable } from './kanaExitAvailable';

export type KanaExitGate = 'locked' | 'open' | 'passed';

export function kanaExitGate({
  items,
  states,
  assessments,
}: {
  readonly items: ReadonlyArray<ContentItem>;
  readonly states: ReadonlyArray<ReviewState>;
  readonly assessments: ReadonlyArray<Assessment>;
}): KanaExitGate {
  if (assessments.some((assessment) => assessment.kind === 'kana-exit' && assessment.passed)) return 'passed';
  return kanaExitAvailable({
    kanaIds: items.flatMap((item) =>
      item.type === 'kana' && isDrillableKana(item) && item.supersededBy === undefined ? [item.id] : [],
    ),
    states,
    assessments,
  })
    ? 'open'
    : 'locked';
}
