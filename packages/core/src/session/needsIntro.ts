import type { ContentItem } from '@wara/content/schema';
import type { ReviewState, SessionActivityKind } from '../domain';

export function needsIntro({
  item,
  state,
  activity,
}: {
  readonly item: ContentItem;
  readonly state: ReviewState | null;
  readonly activity: SessionActivityKind;
}): boolean {
  return item.type === 'kana' && activity === 'new' && state === null;
}
