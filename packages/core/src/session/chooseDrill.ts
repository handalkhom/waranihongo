import type { ContentItem } from '@wara/content/schema';
import type { ReviewState, SessionActivityKind } from '../domain';

export type DrillChoice =
  | { readonly kind: 'kana-to-romaji'; readonly answerMode: 'choice' | 'typed' }
  | { readonly kind: 'romaji-to-kana' }
  | { readonly kind: 'dictation' }
  | { readonly kind: 'word-reading' };

export function chooseDrill({
  item,
  state,
  activity,
  rng,
}: {
  readonly item: ContentItem;
  readonly state: ReviewState | null;
  readonly activity: SessionActivityKind;
  readonly rng: () => number;
}): DrillChoice {
  switch (item.type) {
    case 'vocab':
      return { kind: 'word-reading' };
    case 'kana':
      if (activity === 'production') {
        return rng() < 0.5 ? { kind: 'dictation' } : { kind: 'romaji-to-kana' };
      }
      return { kind: 'kana-to-romaji', answerMode: state !== null && state.state === 'review' ? 'typed' : 'choice' };
    default:
      return item satisfies never;
  }
}
