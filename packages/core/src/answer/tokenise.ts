import type { KanaData } from '@wara/content/schema';
import { ContentValidationError } from '../errors';

function tokenAt(
  reading: string,
  start: number,
  byChar: ReadonlyMap<string, KanaData>,
  longest: number,
): KanaData {
  const found = Array.from({ length: longest }, (_, offset) => longest - offset)
    .map((length) => byChar.get(reading.slice(start, start + length)))
    .find((item) => item !== undefined);
  if (found === undefined) {
    throw new ContentValidationError([
      { path: 'reading', message: `Kana "${reading.slice(start, start + 1)}" tidak ada di tabel kana` },
    ]);
  }
  return found;
}

function tokensFrom(
  reading: string,
  start: number,
  byChar: ReadonlyMap<string, KanaData>,
  longest: number,
): ReadonlyArray<KanaData> {
  if (start >= reading.length) return [];
  const token = tokenAt(reading, start, byChar, longest);
  return [token, ...tokensFrom(reading, start + token.char.length, byChar, longest)];
}

export function tokenise({
  reading,
  kana,
}: {
  readonly reading: string;
  readonly kana: ReadonlyArray<KanaData>;
}): ReadonlyArray<KanaData> {
  return tokensFrom(
    reading,
    0,
    new Map(kana.map((item): readonly [string, KanaData] => [item.char, item])),
    Math.max(0, ...kana.map((item) => item.char.length)),
  );
}
