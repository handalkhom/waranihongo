import { describe, expect, it } from 'vitest';
import { parseBundle, type RawContentFiles } from '../src/bundle';
import { ContentValidationError, type ContentIssue } from '../src/schema/errors';

const kanaItem = (char: string, romaji: string) => ({
  type: 'kana',
  id: `kana:hira:${char}`,
  level: 'kana',
  phase: 0,
  tags: [],
  data: { char, romaji, romajiAccepted: [romaji], script: 'hiragana', group: 'basic' },
});

const ne = kanaItem('ね', 'ne');
const re = kanaItem('れ', 're');

const yakusoku = {
  type: 'vocab',
  source: 'content',
  id: 'vocab:other:やくそく',
  level: 'other',
  phase: 0,
  tags: [],
  data: {
    word: 'やくそく',
    reading: 'やくそく',
    meaningId: 'vocab:other:やくそく',
    pos: 'noun',
    register: 'plain',
    examples: [],
  },
};

const neReGroup = { id: 'ね・れ', items: ['kana:hira:ね', 'kana:hira:れ'] };
const seed = { items: ['kana:hira:ね'] };
const i18n = { 'vocab:other:やくそく': 'janji' };

const validRaw: RawContentFiles = {
  itemFiles: [
    { path: 'kana/hiragana.json', data: [ne, re] },
    { path: 'vocab/reading-practice.json', data: [yakusoku] },
  ],
  confusionGroups: [neReGroup],
  seed,
  i18n,
};

const neWithWrongChar = { ...ne, data: { ...ne.data, char: 'れ' } };

const issuesOf = (raw: RawContentFiles): ReadonlyArray<ContentIssue> => {
  try {
    parseBundle(raw);
  } catch (error) {
    if (error instanceof ContentValidationError) return error.issues;
    throw error;
  }
  return [];
};

const pathsOf = (raw: RawContentFiles): ReadonlyArray<string> =>
  issuesOf(raw).map((issue) => issue.path);

describe('parseBundle', () => {
  it('should concatenate the items of every item file in file order', () => {
    expect(parseBundle(validRaw).items.map((item) => item.id)).toEqual([
      'kana:hira:ね',
      'kana:hira:れ',
      'vocab:other:やくそく',
    ]);
  });

  it('should return the parsed confusion groups, seed, and i18n equal to their input files', () => {
    const bundle = parseBundle(validRaw);
    expect(bundle.confusionGroups).toEqual([neReGroup]);
    expect(bundle.seed).toEqual(seed);
    expect(bundle.i18n).toEqual(i18n);
  });

  it('should throw ContentValidationError when an item file is not an array', () => {
    const raw: RawContentFiles = {
      ...validRaw,
      itemFiles: [
        { path: 'kana/hiragana.json', data: [ne, re] },
        { path: 'vocab/reading-practice.json', data: yakusoku },
      ],
    };
    expect(() => parseBundle(raw)).toThrow(ContentValidationError);
    expect(pathsOf(raw)).toContainEqual(expect.stringMatching(/^vocab\/reading-practice\.json/u));
  });

  it('should report a schema-invalid item under its file path and index', () => {
    const raw: RawContentFiles = {
      ...validRaw,
      itemFiles: [
        { path: 'kana/hiragana.json', data: [re, neWithWrongChar] },
        { path: 'vocab/reading-practice.json', data: [yakusoku] },
      ],
    };
    expect(() => parseBundle(raw)).toThrow(ContentValidationError);
    expect(pathsOf(raw)).toContainEqual(expect.stringMatching(/^kana\/hiragana\.json\[1\]/u));
  });

  it('should collect an invalid item and an invalid seed into one ContentValidationError', () => {
    const raw: RawContentFiles = {
      ...validRaw,
      itemFiles: [
        { path: 'kana/hiragana.json', data: [re, neWithWrongChar] },
        { path: 'vocab/reading-practice.json', data: [yakusoku] },
      ],
      seed: { items: [] },
    };
    expect(() => parseBundle(raw)).toThrow(ContentValidationError);
    const paths = pathsOf(raw);
    expect(paths).toContainEqual(expect.stringMatching(/^kana\/hiragana\.json/u));
    expect(paths).toContainEqual(expect.stringMatching(/^seed\/alan-weak\.json/u));
  });

  it('should report a one-member confusion group under confusion-groups.json', () => {
    const raw: RawContentFiles = {
      ...validRaw,
      confusionGroups: [neReGroup, { id: 'ね', items: ['kana:hira:ね'] }],
    };
    expect(() => parseBundle(raw)).toThrow(ContentValidationError);
    expect(pathsOf(raw)).toContainEqual(expect.stringMatching(/^confusion-groups\.json/u));
  });

  it('should report an empty i18n value under i18n/id.json', () => {
    const raw: RawContentFiles = { ...validRaw, i18n: { 'vocab:other:やくそく': '' } };
    expect(() => parseBundle(raw)).toThrow(ContentValidationError);
    expect(pathsOf(raw)).toContainEqual(expect.stringMatching(/^i18n\/id\.json/u));
  });

  it('should throw ContentValidationError when schema-valid files fail a cross-file rule', () => {
    const raw: RawContentFiles = { ...validRaw, seed: { items: ['kana:hira:わ'] } };
    expect(() => parseBundle(raw)).toThrow(ContentValidationError);
    expect(issuesOf(raw).length).toBeGreaterThanOrEqual(1);
  });
});
