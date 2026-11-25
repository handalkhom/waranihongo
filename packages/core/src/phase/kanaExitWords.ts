import type { ContentItem, VocabItem } from '@wara/content/schema';
import { ContentValidationError } from '../errors';
import { KANA_EXIT_WORD_COUNT } from '../session/defaults';

export function kanaExitWords({
  items,
  rng,
}: {
  readonly items: ReadonlyArray<ContentItem>;
  readonly rng: () => number;
}): ReadonlyArray<VocabItem> {
  const pool = items.flatMap((item): ReadonlyArray<VocabItem> =>
    item.type === 'vocab' &&
    item.source === 'content' &&
    item.tags.includes('reading-practice') &&
    item.supersededBy === undefined
      ? [item]
      : [],
  );
  if (pool.length < KANA_EXIT_WORD_COUNT) {
    throw new ContentValidationError([
      {
        path: 'vocab',
        message: `Kata latihan baca untuk tes keluar kurang: ${String(pool.length)} dari ${String(KANA_EXIT_WORD_COUNT)}`,
      },
    ]);
  }
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const last = shuffled[i];
    const picked = shuffled[j];
    if (last === undefined || picked === undefined) continue;
    shuffled[i] = picked;
    shuffled[j] = last;
  }
  return shuffled.slice(0, KANA_EXIT_WORD_COUNT);
}
