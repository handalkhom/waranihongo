import type { ContentItem, KanaItem } from '@wara/content/schema';
import type { ReviewState } from '../domain';
import { isDrillableKana } from './isDrillableKana';

export function weakSeedChoices({
  seedIds,
  items,
  states,
}: {
  readonly seedIds: ReadonlyArray<string>;
  readonly items: ReadonlyArray<ContentItem>;
  readonly states: ReadonlyArray<ReviewState>;
}): ReadonlyArray<KanaItem> {
  const kanaById: ReadonlyMap<string, KanaItem> = new Map(
    items
      .flatMap((entry) => (entry.type === 'kana' ? [entry] : []))
      .filter((entry) => isDrillableKana(entry) && entry.supersededBy === undefined)
      .map((entry) => [entry.id, entry]),
  );
  const stated: ReadonlySet<string> = new Set(states.map((state) => state.itemId));
  return [...new Set(seedIds)].flatMap((id) => {
    const item = kanaById.get(id);
    return item === undefined || stated.has(id) ? [] : [item];
  });
}
