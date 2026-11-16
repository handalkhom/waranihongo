import { kanaItemSchema, type KanaData, type KanaItem } from '@wara/content/schema';
import { describe, expect, it } from 'vitest';
import { isDrillableKana } from '../../src/session/isDrillableKana';

const kana = (
  script: KanaData['script'],
  char: string,
  romaji: string,
  romajiAccepted: ReadonlyArray<string>,
  group: KanaData['group'] = 'basic',
): KanaItem =>
  kanaItemSchema.parse({
    type: 'kana',
    id: `${script === 'hiragana' ? 'kana:hira:' : 'kana:kata:'}${char}`,
    level: 'kana',
    phase: 0,
    tags: [],
    data: { char, romaji, romajiAccepted, script, group },
  });

const NE = kana('hiragana', 'ね', 'ne', ['ne']);
const WO = kana('hiragana', 'を', 'o', ['o', 'wo']);
const N = kana('hiragana', 'ん', 'n', ['nn', 'n']);
const SHI = kana('katakana', 'シ', 'shi', ['shi', 'si']);
const SHA = kana('hiragana', 'しゃ', 'sha', ['sha', 'sya'], 'combination');
const SMALL_YA = kana('hiragana', 'ゃ', 'xya', ['xya', 'lya'], 'small');
const SMALL_TSU = kana('hiragana', 'っ', '', [], 'small');
const SMALL_TSU_KATA = kana('katakana', 'ッ', '', [], 'small');
const LONG_MARK = kana('katakana', 'ー', '', [], 'mark');

describe('isDrillableKana', () => {
  it.each([
    { char: 'ね', item: NE, expected: true },
    { char: 'を', item: WO, expected: true },
    { char: 'ん', item: N, expected: true },
    { char: 'シ', item: SHI, expected: true },
    { char: 'しゃ', item: SHA, expected: true },
    { char: 'ゃ', item: SMALL_YA, expected: true },
    { char: 'っ', item: SMALL_TSU, expected: false },
    { char: 'ッ', item: SMALL_TSU_KATA, expected: false },
    { char: 'ー', item: LONG_MARK, expected: false },
  ])('should return $expected for $char while ね stays drillable', ({ item, expected }) => {
    expect([isDrillableKana(item), isDrillableKana(NE)]).toEqual([expected, true]);
  });

  it('should keep exactly the kana with non-empty romaji when filtering a mixed list', () => {
    expect(
      [NE, SMALL_TSU, WO, SMALL_TSU_KATA, SHI, LONG_MARK, SHA, SMALL_YA].filter(isDrillableKana).map((item) => item.data.char),
    ).toEqual(['ね', 'を', 'シ', 'しゃ', 'ゃ']);
  });

  it('should treat small ゃ with romaji xya as drillable while small っ in the same group is not', () => {
    expect([isDrillableKana(SMALL_YA), isDrillableKana(SMALL_TSU)]).toEqual([true, false]);
  });

  it('should give the same answers both times when the same items are checked twice', () => {
    const items = [NE, SMALL_TSU, LONG_MARK, SHI];
    expect([items.map(isDrillableKana), items.map(isDrillableKana)]).toEqual([
      [true, false, false, true],
      [true, false, false, true],
    ]);
  });
});
