import { describe, expect, it } from 'vitest';
import { contentBundle } from '../../src/index';
import type { KanaItem, VocabItem } from '../../src/schema/item';

type Script = KanaItem['data']['script'];
type KanaGroup = KanaItem['data']['group'];

const HAN = /\p{Script=Han}/u;

const kanaItems = contentBundle.items.filter((item): item is KanaItem => item.type === 'kana');

const charsOf = (script: Script, group: KanaGroup): ReadonlyArray<string> =>
  kanaItems.filter((item) => item.data.script === script && item.data.group === group).map((item) => item.data.char);

const readingPractice = contentBundle.items.filter((item) => item.tags.includes('reading-practice'));

const practiceWords = readingPractice.filter((item): item is VocabItem => item.type === 'vocab');

const sorted = (values: ReadonlyArray<string>): ReadonlyArray<string> => [...values].sort();

const HIRAGANA_BASIC = Array.from('あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん');
const KATAKANA_BASIC = Array.from('アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン');

describe('real content bundle', () => {
  it('should load the bundle with at least one item when the module is imported', () => {
    expect(contentBundle.items.length).toBeGreaterThan(0);
  });

  it.each([
    ['hiragana', 'kana:hira:', HIRAGANA_BASIC],
    ['katakana', 'kana:kata:', KATAKANA_BASIC],
  ] as const)('should hold exactly the 46 basic %s as basic-group items', (script, prefix, expected) => {
    expect(expected).toHaveLength(46);
    expect(sorted(charsOf(script, 'basic'))).toEqual(sorted(expected));
    const ids = new Set(kanaItems.map((item) => item.id));
    expect(expected.filter((char) => !ids.has(`${prefix}${char}`))).toEqual([]);
  });

  it.each([
    ['hiragana', 'dakuten', 20],
    ['hiragana', 'handakuten', 5],
    ['hiragana', 'combination', 33],
    ['katakana', 'dakuten', 20],
    ['katakana', 'handakuten', 5],
    ['katakana', 'combination', 33],
  ] as const)('should hold %s %s with exactly %i items', (script, group, count) => {
    expect(charsOf(script, group)).toHaveLength(count);
  });

  it('should hold small っ in hiragana', () => {
    expect(charsOf('hiragana', 'small')).toContain('っ');
  });

  it('should hold small ッ and the mark ー in katakana', () => {
    expect(charsOf('katakana', 'small')).toContain('ッ');
    expect(charsOf('katakana', 'mark')).toContain('ー');
  });

  it('should hold ティ, ファ, ウィ and ヴ among the extended katakana', () => {
    expect(charsOf('katakana', 'extended')).toEqual(expect.arrayContaining(['ティ', 'ファ', 'ウィ', 'ヴ']));
  });

  it('should accept its own romaji for every kana item whose romaji is not empty', () => {
    expect(
      kanaItems
        .filter((item) => item.data.romaji !== '' && !item.data.romajiAccepted.includes(item.data.romaji))
        .map((item) => item.id),
    ).toEqual([]);
  });

  it.each([
    ['kana:hira:を', ['o', 'wo']],
    ['kana:hira:ん', ['n', 'nn']],
    ['kana:hira:し', ['shi']],
    ['kana:hira:ふ', ['fu', 'hu']],
  ] as const)('should accept every listed romaji for %s', (id, expected) => {
    expect(kanaItems.find((item) => item.id === id)?.data.romajiAccepted).toEqual(expect.arrayContaining([...expected]));
  });

  it('should hold exactly the 11 confusion groups from the learning plan', () => {
    const hira = (chars: ReadonlyArray<string>): string => chars.map((char) => `kana:hira:${char}`).join('|');
    const kata = (chars: ReadonlyArray<string>): string => chars.map((char) => `kana:kata:${char}`).join('|');
    const expected = [
      hira(['ね', 'れ', 'わ']),
      hira(['ほ', 'は', 'ま']),
      hira(['に', 'こ']),
      hira(['き', 'け']),
      hira(['っ', 'つ']),
      hira(['しゃ', 'しょ']),
      kata(['ン', 'シ', 'ツ', 'ソ']),
      kata(['ノ', 'メ']),
      kata(['ク', 'タ']),
      kata(['コ', 'ユ']),
      kata(['ル', 'レ']),
    ];
    expect(sorted(contentBundle.confusionGroups.map((group) => group.items.join('|')))).toEqual(sorted(expected));
  });

  it('should seed exactly the 17 weak kana in learning-plan order', () => {
    expect(contentBundle.seed.items).toEqual([
      ...['ね', 'ほ', 'れ', 'を', 'ぴ', 'た', 'け', 'に', 'しゃ', 'しゅ', 'しょ', 'っ'].map((char) => `kana:hira:${char}`),
      ...['ン', 'シ', 'ツ', 'ソ', 'ノ'].map((char) => `kana:kata:${char}`),
    ]);
  });

  it('should hold at least 60 reading-practice items', () => {
    expect(readingPractice.length).toBeGreaterThanOrEqual(60);
  });

  it('should hold at least 50 distinct reading-practice words for the kana-exit draw', () => {
    expect(new Set(practiceWords.map((item) => item.data.word)).size).toBeGreaterThanOrEqual(50);
  });

  it('should tag only phase-0 content vocabulary as reading-practice', () => {
    expect(readingPractice.filter((item) => item.type !== 'vocab' || item.phase !== 0).map((item) => item.id)).toEqual([]);
  });

  it('should keep every reading-practice word free of kanji', () => {
    expect(practiceWords.filter((item) => HAN.test(item.data.word)).map((item) => item.id)).toEqual([]);
  });

  it('should resolve every reading-practice meaningId to a non-empty Indonesian text', () => {
    expect(
      practiceWords
        .filter((item) => {
          const text = contentBundle.i18n[item.data.meaningId];
          return text === undefined || text.trim() === '';
        })
        .map((item) => item.id),
    ).toEqual([]);
  });

  it.each([
    ...['ね', 'ほ', 'れ', 'ぴ', 'た', 'け', 'に', 'っ', 'しゃ', 'しゅ', 'しょ', 'ン', 'シ', 'ツ', 'ソ', 'ノ'].map(
      (char) => [char, 2] as const,
    ),
    ['を', 1] as const,
  ])('should use the weak kana %s in at least %i reading-practice words', (char, minimum) => {
    expect(practiceWords.filter((item) => item.data.word.includes(char)).length).toBeGreaterThanOrEqual(minimum);
  });
});
