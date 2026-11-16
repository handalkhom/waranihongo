import type { KanaData } from '@wara/content/schema';
import { describe, expect, it } from 'vitest';
import { romajiMatches } from '../../src/answer/romajiMatches';
import { romanize } from '../../src/answer/romanize';
import { ContentValidationError } from '../../src/errors';

const hira = (
  char: string,
  romaji: string,
  romajiAccepted: ReadonlyArray<string>,
  group: KanaData['group'] = 'basic',
): KanaData => ({
  char,
  romaji,
  romajiAccepted,
  script: 'hiragana',
  group,
});

const kata = (
  char: string,
  romaji: string,
  romajiAccepted: ReadonlyArray<string>,
  group: KanaData['group'] = 'basic',
): KanaData => ({
  char,
  romaji,
  romajiAccepted,
  script: 'katakana',
  group,
});

const KANA: ReadonlyArray<KanaData> = [
  hira('あ', 'a', ['a']),
  hira('い', 'i', ['i']),
  hira('え', 'e', ['e']),
  hira('き', 'ki', ['ki']),
  hira('さ', 'sa', ['sa']),
  hira('ざ', 'za', ['za'], 'dakuten'),
  hira('し', 'shi', ['si', 'shi']),
  hira('ち', 'chi', ['ti', 'chi']),
  hira('て', 'te', ['te']),
  hira('ね', 'ne', ['ne']),
  hira('ふ', 'fu', ['hu', 'fu']),
  hira('ほ', 'ho', ['ho']),
  hira('ぽ', 'po', ['po'], 'handakuten'),
  hira('ま', 'ma', ['ma']),
  hira('や', 'ya', ['ya']),
  hira('ん', 'n', ['nn', 'n']),
  hira('しゃ', 'sha', ['sya', 'sha'], 'combination'),
  hira('しょ', 'sho', ['syo', 'sho'], 'combination'),
  hira('ちゃ', 'cha', ['cya', 'cha'], 'combination'),
  hira('ゃ', 'xya', ['xya', 'lya'], 'small'),
  hira('っ', '', [], 'small'),
  kata('ア', 'a', ['a']),
  kata('コ', 'ko', ['ko']),
  kata('ト', 'to', ['to']),
  kata('ヒ', 'hi', ['hi']),
  kata('メ', 'me', ['me']),
  kata('ラ', 'ra', ['ra']),
  kata('ン', 'n', ['nn', 'n']),
  kata('ッ', '', [], 'small'),
  kata('ー', '', [], 'mark'),
];

const romanizeOf = (reading: string): string => romanize({ reading, kana: KANA });

const READINGS: ReadonlyArray<string> = [
  'ね',
  'し',
  'ふね',
  'しゃ',
  'しゃしん',
  'いっしょ',
  'きって',
  'ざっし',
  'ヒット',
  'まっちゃ',
  'いっち',
  'っち',
  'あっ',
  'あっあ',
  'コーヒー',
  'ラーメン',
  'ーコ',
  'ンー',
  'さんぽ',
  'ほん',
  'きんえん',
  'ほんや',
  'アンアン',
];

describe('romanize', () => {
  describe('canonical romaji', () => {
    it('should give ne for ね', () => {
      expect(romanizeOf('ね')).toBe('ne');
    });

    it('should give the canonical romaji shi for し, not the first accepted variant si', () => {
      expect(romanizeOf('し')).toBe('shi');
    });

    it('should give fune for ふね, using the canonical fu rather than the variant hu', () => {
      expect(romanizeOf('ふね')).toBe('fune');
    });
  });

  describe('longest match', () => {
    it('should give sha for しゃ, not shixya, because しゃ wins over し plus ゃ', () => {
      expect(romanizeOf('しゃ')).toBe('sha');
    });

    it('should give shashin for しゃしん', () => {
      expect(romanizeOf('しゃしん')).toBe('shashin');
    });

    it('should give issho for いっしょ', () => {
      expect(romanizeOf('いっしょ')).toBe('issho');
    });
  });

  describe('small っ and ッ', () => {
    it('should give kitte for きって by doubling the t of te', () => {
      expect(romanizeOf('きって')).toBe('kitte');
    });

    it('should give zasshi for ざっし by doubling the s of the canonical shi', () => {
      expect(romanizeOf('ざっし')).toBe('zasshi');
    });

    it('should give hitto for ヒット with katakana ッ', () => {
      expect(romanizeOf('ヒット')).toBe('hitto');
    });

    it('should give matcha for まっちゃ by adding t before the ch-initial cha', () => {
      expect(romanizeOf('まっちゃ')).toBe('matcha');
    });

    it('should give itchi for いっち by adding t before the ch-initial chi', () => {
      expect(romanizeOf('いっち')).toBe('itchi');
    });

    it('should give tchi for っち when っ opens the reading', () => {
      expect(romanizeOf('っち')).toBe('tchi');
    });

    it('should add nothing for っ at the end of a reading, giving a for あっ', () => {
      expect(romanizeOf('あっ')).toBe('a');
    });

    it('should add nothing for っ before a vowel-initial token, giving aa for あっあ', () => {
      expect(romanizeOf('あっあ')).toBe('aa');
    });
  });

  describe('long vowel mark ー', () => {
    it('should give koohii for コーヒー by repeating the previous vowel', () => {
      expect(romanizeOf('コーヒー')).toBe('koohii');
    });

    it('should give raamen for ラーメン', () => {
      expect(romanizeOf('ラーメン')).toBe('raamen');
    });

    it('should give -ko for ーコ because ー at the start of a reading is -', () => {
      expect(romanizeOf('ーコ')).toBe('-ko');
    });

    it('should give n- for ンー because ー right after ン is -', () => {
      expect(romanizeOf('ンー')).toBe('n-');
    });
  });

  describe('ん and ン', () => {
    it('should give sanpo for さんぽ with ん as n before a consonant', () => {
      expect(romanizeOf('さんぽ')).toBe('sanpo');
    });

    it('should give hon for ほん with ん as n at the end of a reading', () => {
      expect(romanizeOf('ほん')).toBe('hon');
    });

    it("should give kin'en for きんえん with ん as n' before a vowel-initial token", () => {
      expect(romanizeOf('きんえん')).toBe("kin'en");
    });

    it("should give hon'ya for ほんや with ん as n' before a y-initial token", () => {
      expect(romanizeOf('ほんや')).toBe("hon'ya");
    });

    it("should give an'an for アンアン with katakana ン as n' before a vowel and n at the end", () => {
      expect(romanizeOf('アンアン')).toBe("an'an");
    });
  });

  describe('missing kana', () => {
    it('should throw ContentValidationError when the reading holds a kana absent from the table', () => {
      expect(() => romanizeOf('ねぬ')).toThrow(ContentValidationError);
    });
  });

  describe('agreement with romajiMatches', () => {
    it.each(READINGS)('should produce romaji that romajiMatches accepts for %s', (reading) => {
      expect(romajiMatches({ reading, given: romanize({ reading, kana: KANA }), kana: KANA })).toBe(true);
    });
  });

  describe('determinism', () => {
    it('should return matcha both times when まっちゃ is romanized twice', () => {
      expect([romanizeOf('まっちゃ'), romanizeOf('まっちゃ')]).toEqual(['matcha', 'matcha']);
    });
  });
});
