import type { KanaData } from '@wara/content/schema';
import { describe, expect, it } from 'vitest';
import { romajiMatches } from '../../src/answer/romajiMatches';
import { ContentValidationError } from '../../src/errors';

const hira = (char: string, romajiAccepted: ReadonlyArray<string>, group: KanaData['group'] = 'basic'): KanaData => ({
  char,
  romaji: romajiAccepted[0] ?? '',
  romajiAccepted,
  script: 'hiragana',
  group,
});

const kata = (char: string, romajiAccepted: ReadonlyArray<string>, group: KanaData['group'] = 'basic'): KanaData => ({
  char,
  romaji: romajiAccepted[0] ?? '',
  romajiAccepted,
  script: 'katakana',
  group,
});

const KANA: ReadonlyArray<KanaData> = [
  hira('あ', ['a']),
  hira('い', ['i']),
  hira('え', ['e']),
  hira('き', ['ki']),
  hira('し', ['shi', 'si']),
  hira('ち', ['chi', 'ti']),
  hira('つ', ['tsu', 'tu']),
  hira('て', ['te']),
  hira('ね', ['ne']),
  hira('ほ', ['ho']),
  hira('ふ', ['fu', 'hu']),
  hira('ま', ['ma']),
  hira('や', ['ya']),
  hira('れ', ['re']),
  hira('を', ['o', 'wo']),
  hira('ん', ['n', 'nn']),
  hira('しゃ', ['sha', 'sya'], 'combination'),
  hira('しょ', ['sho', 'syo'], 'combination'),
  hira('ちゃ', ['cha', 'cya'], 'combination'),
  hira('ゃ', ['xya', 'lya'], 'small'),
  hira('っ', [], 'small'),
  kata('コ', ['ko']),
  kata('ト', ['to']),
  kata('ヒ', ['hi']),
  kata('ン', ['n', 'nn']),
  kata('ッ', [], 'small'),
  kata('ー', [], 'mark'),
];

const matches = (reading: string, given: string): boolean => romajiMatches({ reading, given, kana: KANA });

describe('romajiMatches', () => {
  describe('single kana', () => {
    it('should accept ne for ね', () => {
      expect(matches('ね', 'ne')).toBe(true);
    });

    it('should reject re for ね', () => {
      expect(matches('ね', 're')).toBe(false);
    });

    it('should reject an answer that only starts with the reading, nex for ね', () => {
      expect(matches('ね', 'nex')).toBe(false);
    });
  });

  describe('accepted variants', () => {
    it('should accept both shi and si for し', () => {
      expect([matches('し', 'shi'), matches('し', 'si')]).toEqual([true, true]);
    });

    it('should accept both o and wo for を', () => {
      expect([matches('を', 'o'), matches('を', 'wo')]).toEqual([true, true]);
    });

    it('should accept both fu and hu for ふ', () => {
      expect([matches('ふ', 'fu'), matches('ふ', 'hu')]).toEqual([true, true]);
    });

    it('should accept tsu for つ', () => {
      expect(matches('つ', 'tsu')).toBe(true);
    });
  });

  describe('combination kana and longest match', () => {
    it('should accept both sha and sya for しゃ', () => {
      expect([matches('しゃ', 'sha'), matches('しゃ', 'sya')]).toEqual([true, true]);
    });

    it('should reject sho for しゃ', () => {
      expect(matches('しゃ', 'sho')).toBe(false);
    });

    it('should reject shixya for しゃ because the longest match しゃ wins over し plus ゃ', () => {
      expect(matches('しゃ', 'shixya')).toBe(false);
    });
  });

  describe('small っ and ッ', () => {
    it('should accept kitte for きって', () => {
      expect(matches('きって', 'kitte')).toBe(true);
    });

    it('should reject kisutte, kitsute, and kite for きって', () => {
      expect([matches('きって', 'kisutte'), matches('きって', 'kitsute'), matches('きって', 'kite')]).toEqual([
        false,
        false,
        false,
      ]);
    });

    it('should double the first consonant of every variant, accepting issho and issyo for いっしょ', () => {
      expect([matches('いっしょ', 'issho'), matches('いっしょ', 'issyo')]).toEqual([true, true]);
    });

    it('should reject isho for いっしょ', () => {
      expect(matches('いっしょ', 'isho')).toBe(false);
    });

    it('should accept maccha, matcha, and maccya for まっちゃ', () => {
      expect([matches('まっちゃ', 'maccha'), matches('まっちゃ', 'matcha'), matches('まっちゃ', 'maccya')]).toEqual([
        true,
        true,
        true,
      ]);
    });

    it('should accept icchi, itchi, and itti for いっち', () => {
      expect([matches('いっち', 'icchi'), matches('いっち', 'itchi'), matches('いっち', 'itti')]).toEqual([
        true,
        true,
        true,
      ]);
    });

    it('should accept hitto for ヒット with katakana ッ', () => {
      expect(matches('ヒット', 'hitto')).toBe(true);
    });

    it('should add nothing for っ at the end of a reading, accepting a for あっ', () => {
      expect(matches('あっ', 'a')).toBe(true);
    });

    it('should add nothing for っ before a vowel-initial token, accepting aa for あっあ', () => {
      expect(matches('あっあ', 'aa')).toBe(true);
    });
  });

  describe('long vowel mark ー', () => {
    it('should accept koohii, ko-hi-, and koohi- for コーヒー', () => {
      expect([matches('コーヒー', 'koohii'), matches('コーヒー', 'ko-hi-'), matches('コーヒー', 'koohi-')]).toEqual([
        true,
        true,
        true,
      ]);
    });

    it('should reject kohi for コーヒー', () => {
      expect(matches('コーヒー', 'kohi')).toBe(false);
    });

    it('should accept n- and nn- for ンー', () => {
      expect([matches('ンー', 'n-'), matches('ンー', 'nn-')]).toEqual([true, true]);
    });

    it('should reject nn and n for ンー because ー after ン accepts only -', () => {
      expect([matches('ンー', 'nn'), matches('ンー', 'n')]).toEqual([false, false]);
    });

    it('should accept -ko for ーコ', () => {
      expect(matches('ーコ', '-ko')).toBe(true);
    });

    it('should reject ko for ーコ because ー at the start of a reading accepts only -', () => {
      expect(matches('ーコ', 'ko')).toBe(false);
    });
  });

  describe('ん', () => {
    it('should accept both ten and tenn for てん', () => {
      expect([matches('てん', 'ten'), matches('てん', 'tenn')]).toEqual([true, true]);
    });

    it("should accept both kin'en and kinnen for きんえん", () => {
      expect([matches('きんえん', "kin'en"), matches('きんえん', 'kinnen')]).toEqual([true, true]);
    });

    it('should reject kinen for きんえん because ん before a vowel needs n\' or nn', () => {
      expect(matches('きんえん', 'kinen')).toBe(false);
    });

    it("should accept both hon'ya and honnya for ほんや", () => {
      expect([matches('ほんや', "hon'ya"), matches('ほんや', 'honnya')]).toEqual([true, true]);
    });

    it('should reject honya for ほんや because ん before y needs n\' or nn', () => {
      expect(matches('ほんや', 'honya')).toBe(false);
    });
  });

  describe('normalisation', () => {
    it('should accept uppercase with surrounding spaces, "  KITTE " for きって', () => {
      expect(matches('きって', '  KITTE ')).toBe(true);
    });

    it('should reject an empty answer for ね', () => {
      expect(matches('ね', '')).toBe(false);
    });
  });

  describe('missing kana', () => {
    it('should throw ContentValidationError when the reading holds a kana absent from the table', () => {
      expect(() => matches('ねぬ', 'nenu')).toThrow(ContentValidationError);
    });
  });

  describe('determinism', () => {
    it('should return the same result for the same input twice', () => {
      expect([matches('まっちゃ', 'matcha'), matches('まっちゃ', 'matcha')]).toEqual([true, true]);
    });
  });
});
