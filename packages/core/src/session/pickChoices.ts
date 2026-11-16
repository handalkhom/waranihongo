import type { ConfusionGroup, ContentItem, KanaItem } from '@wara/content/schema';
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

const addDistinct = (taken: ReadonlyArray<KanaItem>, candidate: KanaItem): ReadonlyArray<KanaItem> =>
  taken.some((entry) => entry.id === candidate.id || entry.data.romaji === candidate.data.romaji)
    ? taken
    : [...taken, candidate];

export function pickChoices({
  item,
  items,
  groups,
  count,
  rng,
}: {
  readonly item: KanaItem;
  readonly items: ReadonlyArray<ContentItem>;
  readonly groups: ReadonlyArray<ConfusionGroup>;
  readonly count: number;
  readonly rng: () => number;
}): ReadonlyArray<KanaItem> {
  const pool = items
    .flatMap((entry) => (entry.type === 'kana' ? [entry] : []))
    .filter(
      (entry) =>
        isDrillableKana(entry) &&
        entry.supersededBy === undefined &&
        entry.data.script === item.data.script &&
        entry.id !== item.id,
    );
  const poolById: ReadonlyMap<string, KanaItem> = new Map(pool.map((entry) => [entry.id, entry]));
  const partners = groups
    .filter((group) => group.items.includes(item.id))
    .flatMap((group) => group.items)
    .flatMap((id) => {
      const partner = poolById.get(id);
      return partner === undefined ? [] : [partner];
    });
  const sameGroup = shuffle(
    pool.filter((entry) => entry.data.group === item.data.group),
    rng,
  );
  const rest = shuffle(
    pool.filter((entry) => entry.data.group !== item.data.group),
    rng,
  );
  const chosen = [...partners, ...sameGroup, ...rest].reduce(addDistinct, [item]);
  return shuffle([item, ...chosen.slice(1, count)], rng);
}
