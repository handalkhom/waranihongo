import { describe, expect, it } from 'vitest';
import { contentIdSchema, customVocabIdSchema } from '../../src/schema/id';

const accepts = (schema: typeof contentIdSchema, id: string): boolean => schema.safeParse(id).success;

describe('contentIdSchema: form <type>:<group>:<slug>', () => {
  it.each([
    ['kana:hira', 'a missing slug segment'],
    ['kanahira:ね', 'a missing separator between type and group'],
    ['', 'the empty string'],
    ['kana::ね', 'an empty group'],
  ])('should reject %j (%s)', (id) => {
    expect(accepts(contentIdSchema, id)).toBe(false);
  });

  it.each([
    ['noun:n5:友達', 'an unknown type'],
    ['kana:roma:ね', 'an unknown kana group'],
    ['vocab:n1:友達', 'n1, which is not a vocab level'],
    ['kanji:other:日', 'other, which is not a kanji level'],
    ['grammar:other:に・で', 'other, which is not a grammar level'],
  ])('should reject %j (%s)', (id) => {
    expect(accepts(contentIdSchema, id)).toBe(false);
  });

  it.each(['vocab:n5:友達', 'vocab:n4:友達', 'vocab:n3:友達', 'vocab:n2:友達', 'vocab:other:やくそく'])(
    'should accept the vocab level in %j',
    (id) => {
      expect(accepts(contentIdSchema, id)).toBe(true);
    },
  );

  it.each(['kanji:n5:日', 'kanji:n4:日', 'kanji:n3:日', 'kanji:n2:日', 'grammar:n5:に・で', 'grammar:n2:に・で'])(
    'should accept the level in %j',
    (id) => {
      expect(accepts(contentIdSchema, id)).toBe(true);
    },
  );

  it('should reject vocab:custom:<uuid>, which never appears in a data file', () => {
    expect(accepts(contentIdSchema, 'vocab:custom:3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c')).toBe(false);
  });
});

describe('contentIdSchema: every id is NFC', () => {
  it.each(['kana:hira:が', 'vocab:n5:ぎんこう', 'kana:kata:ガ'])(
    'should reject the decomposed (NFD) form of %j',
    (nfc) => {
      const nfd = nfc.normalize('NFD');
      expect(nfd).not.toBe(nfc);
      expect(accepts(contentIdSchema, nfd)).toBe(false);
    },
  );

  it.each(['kana:hira:が', 'vocab:n5:ぎんこう', 'kana:kata:ガ'])('should accept the composed (NFC) form of %j', (nfc) => {
    expect(accepts(contentIdSchema, nfc)).toBe(true);
  });
});

describe('contentIdSchema: kana:hira slug is hiragana only', () => {
  it.each(['kana:hira:ね', 'kana:hira:ぢ', 'kana:hira:っ', 'kana:hira:しゃ'])('should accept %j', (id) => {
    expect(accepts(contentIdSchema, id)).toBe(true);
  });

  it.each([
    ['kana:hira:ネ', 'a katakana slug'],
    ['kana:hira:ne', 'a romaji slug'],
    ['kana:hira:', 'an empty slug'],
    ['kana:hira:ねー', 'a slug containing the prolonged sound mark, which is not hiragana'],
  ])('should reject %j (%s)', (id) => {
    expect(accepts(contentIdSchema, id)).toBe(false);
  });
});

describe('contentIdSchema: kana:kata slug is katakana only', () => {
  it.each(['kana:kata:ン', 'kana:kata:ティ', 'kana:kata:ー', 'kana:kata:ッ'])('should accept %j', (id) => {
    expect(accepts(contentIdSchema, id)).toBe(true);
  });

  it.each([
    ['kana:kata:力', 'the kanji 力 (U+529B), a look-alike of カ'],
    ['kana:kata:一', 'the kanji 一 (U+4E00), a look-alike of ー'],
    ['kana:kata:ニ二', 'ニ followed by the kanji 二 (U+4E8C)'],
    ['kana:kata:ね', 'a hiragana slug'],
    ['kana:kata:', 'an empty slug'],
  ])('should reject %j whose slug is %s', (id) => {
    expect(accepts(contentIdSchema, id)).toBe(false);
  });
});

describe('contentIdSchema: kanji slug is exactly one Han ideograph', () => {
  it('should accept kanji:n5:日', () => {
    expect(accepts(contentIdSchema, 'kanji:n5:日')).toBe(true);
  });

  it.each([
    ['kanji:n5:日本', 'two ideographs'],
    ['kanji:n5:に', 'a hiragana slug'],
    ['kanji:n5:', 'an empty slug'],
  ])('should reject %j whose slug is %s', (id) => {
    expect(accepts(contentIdSchema, id)).toBe(false);
  });
});

describe('contentIdSchema: vocab slug is non-empty Japanese without Latin letters', () => {
  it.each(['vocab:n5:友達', 'vocab:other:やくそく', 'vocab:n5:コーヒー', 'vocab:n5:橋', 'vocab:n5:箸'])(
    'should accept %j',
    (id) => {
      expect(accepts(contentIdSchema, id)).toBe(true);
    },
  );

  it.each([
    ['vocab:n5:tomodachi', 'an ASCII Latin slug'],
    ['vocab:n5:ＴＶ', 'a full-width Latin slug (ＴＶ)'],
    ['vocab:n5:ｔｖ', 'a full-width lowercase Latin slug (ｔｖ)'],
    ['vocab:n5:', 'an empty slug'],
  ])('should reject %j whose slug is %s', (id) => {
    expect(accepts(contentIdSchema, id)).toBe(false);
  });
});

describe('contentIdSchema: vocab ~<reading> suffix is kana only', () => {
  it.each(['vocab:n5:一日~ついたち', 'vocab:n5:一日~いちにち'])('should accept %j', (id) => {
    expect(accepts(contentIdSchema, id)).toBe(true);
  });

  it.each([
    ['vocab:n5:一日~tsuitachi', 'a romaji reading'],
    ['vocab:n5:一日~', 'an empty reading'],
    ['vocab:n5:一日~一日', 'a kanji reading'],
  ])('should reject %j with %s', (id) => {
    expect(accepts(contentIdSchema, id)).toBe(false);
  });
});

describe('contentIdSchema: grammar slug is non-empty Japanese without Latin letters', () => {
  it.each(['grammar:n5:～ませんでした', 'grammar:n5:に・で'])('should accept %j', (id) => {
    expect(accepts(contentIdSchema, id)).toBe(true);
  });

  it.each([
    ['grammar:n5:masendeshita', 'a romaji slug'],
    ['grammar:n5:', 'an empty slug'],
  ])('should reject %j whose slug is %s', (id) => {
    expect(accepts(contentIdSchema, id)).toBe(false);
  });
});

describe('customVocabIdSchema: vocab:custom:<lowercase uuid>', () => {
  it('should accept vocab:custom: followed by a lowercase uuid', () => {
    expect(accepts(customVocabIdSchema, 'vocab:custom:3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c')).toBe(true);
  });

  it.each([
    ['vocab:custom:3F2B8C1E-9A4D-4E7B-8C2A-1D5E6F7A8B9C', 'an uppercase uuid'],
    ['vocab:custom:友達', 'a slug that is not a uuid'],
    ['vocab:custom:', 'a missing slug'],
    ['vocab:custom:3f2b8c1e-9a4d-4e7b-8c2a', 'a truncated uuid'],
    ['vocab:n5:友達', 'a content id'],
  ])('should reject %j (%s)', (id) => {
    expect(accepts(customVocabIdSchema, id)).toBe(false);
  });
});
