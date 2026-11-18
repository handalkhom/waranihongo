import type { ContentItem, KanaItem } from '@wara/content/schema';
import type { ReviewState } from '../domain';
import { isDrillableKana } from './isDrillableKana';

const shuffle = (values: ReadonlyArray<KanaItem>, rng: () => number): ReadonlyArray<KanaItem> => {
  let result = values;
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const atI = result[i];
    const atJ = result[j];
    if (atI === undefined || atJ === undefined) continue;
    result = result.with(i, atJ).with(j, atI);
  }
  return result;
};

export function placementItems({
  items,
  states,
  rng,
}: {
  readonly items: ReadonlyArray<ContentItem>;
  readonly states: ReadonlyArray<ReviewState>;
  readonly rng: () => number;
}): ReadonlyArray<KanaItem> {
  const met = new Set(states.map((state) => state.itemId));
  const eligible = items.flatMap((item) =>
    item.type === 'kana' &&
    item.data.group === 'basic' &&
    isDrillableKana(item) &&
    item.supersededBy === undefined &&
    !met.has(item.id)
      ? [item]
      : [],
  );
  return [
    ...shuffle(
      eligible.filter((item) => item.data.script === 'hiragana'),
      rng,
    ),
    ...shuffle(
      eligible.filter((item) => item.data.script === 'katakana'),
      rng,
    ),
  ];
}
