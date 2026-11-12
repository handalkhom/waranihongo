import { describe, expect, it } from 'vitest';
import type { ContentIssue } from '../../src/schema/errors';
import type { KanaItem, VocabItem } from '../../src/schema/item';
import { validateBundle, type ContentBundle } from '../../src/validate/validateBundle';

const kana = (char: string, romaji: string): KanaItem => ({
  type: 'kana',
  id: `kana:hira:${char}`,
  level: 'kana',
  phase: 0,
  tags: [],
  data: { char, romaji, romajiAccepted: [romaji], script: 'hiragana', group: 'basic' },
});

const yakusoku = (): VocabItem => ({
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
});

const neReWaGroup = (): ContentBundle['confusionGroups'][number] => ({
  id: 'ね・れ・わ',
  items: ['kana:hira:ね', 'kana:hira:れ', 'kana:hira:わ'],
});

const baseline = (): ContentBundle => ({
  items: [kana('ね', 'ne'), kana('れ', 're'), kana('わ', 'wa'), yakusoku()],
  confusionGroups: [neReWaGroup()],
  seed: { items: ['kana:hira:ね'] },
  i18n: { 'vocab:other:やくそく': 'janji' },
});

const pathsOf = (issues: ReadonlyArray<ContentIssue>): ReadonlyArray<string> => issues.map((issue) => issue.path);

const deepFreeze = <T>(value: T): T => {
  if (typeof value !== 'object' || value === null) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
};

describe('validateBundle', () => {
  it('should report no issue for a bundle whose every reference resolves', () => {
    expect(validateBundle(baseline())).toEqual([]);
  });

  it('should report items[4].id when an item id repeats', () => {
    const bundle = baseline();
    const issues = validateBundle({ ...bundle, items: [...bundle.items, kana('ね', 'ne')] });

    expect(pathsOf(issues)).toEqual(['items[4].id']);
    expect(issues.every((issue) => issue.message.length > 0)).toBe(true);
  });

  it('should report every later occurrence of a repeated item id but never the first', () => {
    const bundle = baseline();
    const issues = validateBundle({ ...bundle, items: [...bundle.items, kana('ね', 'ne'), kana('ね', 'ne')] });

    expect(pathsOf(issues)).toEqual(['items[4].id', 'items[5].id']);
  });

  it('should report confusionGroups[1].id when a confusion-group id repeats', () => {
    const issues = validateBundle({ ...baseline(), confusionGroups: [neReWaGroup(), neReWaGroup()] });

    expect(pathsOf(issues)).toEqual(['confusionGroups[1].id']);
    expect(issues.every((issue) => issue.message.length > 0)).toBe(true);
  });

  it('should report confusionGroups[0].items[1] when a confusion-group member is not an item', () => {
    const issues = validateBundle({
      ...baseline(),
      confusionGroups: [{ id: 'ね・を・わ', items: ['kana:hira:ね', 'kana:hira:を', 'kana:hira:わ'] }],
    });

    expect(pathsOf(issues)).toEqual(['confusionGroups[0].items[1]']);
    expect(issues.every((issue) => issue.message.length > 0)).toBe(true);
  });

  it('should report seed.items[1] when a seed id is not an item', () => {
    const issues = validateBundle({ ...baseline(), seed: { items: ['kana:hira:ね', 'kana:kata:ン'] } });

    expect(pathsOf(issues)).toEqual(['seed.items[1]']);
    expect(issues.every((issue) => issue.message.length > 0)).toBe(true);
  });

  it('should report items[2].supersededBy when supersededBy points to a missing id', () => {
    const issues = validateBundle({
      ...baseline(),
      items: [kana('ね', 'ne'), kana('れ', 're'), { ...kana('わ', 'wa'), supersededBy: 'kana:hira:ゐ' }, yakusoku()],
    });

    expect(pathsOf(issues)).toEqual(['items[2].supersededBy']);
    expect(issues.every((issue) => issue.message.length > 0)).toBe(true);
  });

  it('should report no issue when supersededBy points to an existing item', () => {
    const issues = validateBundle({
      ...baseline(),
      items: [kana('ね', 'ne'), kana('れ', 're'), { ...kana('わ', 'wa'), supersededBy: 'kana:hira:ね' }, yakusoku()],
    });

    expect(issues).toEqual([]);
  });

  it('should report items[3].data.meaningId when a vocab meaningId has no i18n entry', () => {
    const issues = validateBundle({ ...baseline(), i18n: {} });

    expect(pathsOf(issues)).toEqual(['items[3].data.meaningId']);
    expect(issues.every((issue) => issue.message.length > 0)).toBe(true);
  });

  it('should report no meaningId issue for kana items when i18n is empty', () => {
    const bundle = baseline();
    const issues = validateBundle({ ...bundle, items: bundle.items.slice(0, 3), i18n: {} });

    expect(issues).toEqual([]);
  });

  it('should report every problem in input order: items by index, then confusionGroups, then seed', () => {
    const issues = validateBundle({
      items: [
        kana('ね', 'ne'),
        kana('れ', 're'),
        { ...kana('わ', 'wa'), supersededBy: 'kana:hira:ゐ' },
        yakusoku(),
        kana('ね', 'ne'),
      ],
      confusionGroups: [
        { id: 'ね・れ・わ', items: ['kana:hira:ね', 'kana:hira:を', 'kana:hira:わ'] },
        neReWaGroup(),
      ],
      seed: { items: ['kana:hira:ね', 'kana:kata:ン'] },
      i18n: {},
    });

    expect(pathsOf(issues)).toEqual([
      'items[2].supersededBy',
      'items[3].data.meaningId',
      'items[4].id',
      'confusionGroups[0].items[1]',
      'confusionGroups[1].id',
      'seed.items[1]',
    ]);
    expect(issues.every((issue) => issue.message.length > 0)).toBe(true);
  });

  it('should not mutate a deep-frozen bundle and should return the same issues as for an unfrozen one', () => {
    const bundle = baseline();
    const frozen = deepFreeze({ ...bundle, items: [...bundle.items, kana('ね', 'ne')], i18n: {} });
    const unfrozen = { ...baseline(), items: [...baseline().items, kana('ね', 'ne')], i18n: {} };

    expect(() => validateBundle(frozen)).not.toThrow();
    expect(validateBundle(frozen)).toEqual(validateBundle(unfrozen));
    expect(frozen).toEqual(unfrozen);
  });
});
