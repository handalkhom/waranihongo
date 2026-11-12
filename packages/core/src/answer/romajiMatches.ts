import type { KanaData } from '@wara/content/schema';
import { ContentValidationError } from '../errors';

const SOKUON: ReadonlySet<string> = new Set(['っ', 'ッ']);
const MORAIC_N: ReadonlySet<string> = new Set(['ん', 'ン']);
const LONG_VOWEL_MARK = 'ー';
const LONG_VOWEL_TYPED = '-';
const MORAIC_N_BEFORE_VOWEL: ReadonlyArray<string> = ["n'", 'nn'];

interface Reading {
  readonly tokens: ReadonlyArray<KanaData>;
  readonly given: string;
}

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

function tokenise(
  reading: string,
  start: number,
  byChar: ReadonlyMap<string, KanaData>,
  longest: number,
): ReadonlyArray<KanaData> {
  if (start >= reading.length) return [];
  const token = tokenAt(reading, start, byChar, longest);
  return [token, ...tokenise(reading, start + token.char.length, byChar, longest)];
}

function variantsOf(tokens: ReadonlyArray<KanaData>, index: number, previous: string): ReadonlyArray<string> {
  const token = tokens[index];
  if (token === undefined) return [];
  if (token.char === LONG_VOWEL_MARK) {
    return /[aeiou]$/.test(previous) ? [previous.slice(-1), LONG_VOWEL_TYPED] : [LONG_VOWEL_TYPED];
  }
  const next = tokens[index + 1];
  if (MORAIC_N.has(token.char) && next !== undefined && next.romajiAccepted.some((v) => /^[aeiouy]/.test(v))) {
    return MORAIC_N_BEFORE_VOWEL;
  }
  return token.romajiAccepted;
}

function geminate(variant: string): ReadonlyArray<string> {
  if (variant.startsWith('ch')) return [`c${variant}`, `t${variant}`];
  return /^[b-df-hj-np-tv-z]/.test(variant) ? [`${variant.slice(0, 1)}${variant}`] : [variant];
}

function advance(
  reading: Reading,
  candidates: ReadonlyArray<string>,
  nextIndex: number,
  position: number,
): boolean {
  return candidates.some(
    (candidate) =>
      reading.given.startsWith(candidate, position) &&
      matchFrom(reading, nextIndex, position + candidate.length, candidate),
  );
}

function matchFrom(reading: Reading, index: number, position: number, previous: string): boolean {
  const token = reading.tokens[index];
  if (token === undefined) return position === reading.given.length;
  if (!SOKUON.has(token.char)) return advance(reading, variantsOf(reading.tokens, index, previous), index + 1, position);
  if (reading.tokens[index + 1] === undefined) return advance(reading, [''], index + 1, position);
  return advance(reading, variantsOf(reading.tokens, index + 1, previous).flatMap(geminate), index + 2, position);
}

export function romajiMatches({
  reading,
  given,
  kana,
}: {
  readonly reading: string;
  readonly given: string;
  readonly kana: ReadonlyArray<KanaData>;
}): boolean {
  const byChar: ReadonlyMap<string, KanaData> = new Map(
    kana.map((item): readonly [string, KanaData] => [item.char, item]),
  );
  const longest = Math.max(0, ...kana.map((item) => item.char.length));
  return matchFrom(
    { tokens: tokenise(reading, 0, byChar, longest), given: given.trim().toLowerCase() },
    0,
    0,
    '',
  );
}
