import type { KanaItem } from '@wara/content/schema';

export function isDrillableKana(item: KanaItem): boolean {
  return item.data.romaji !== '';
}
