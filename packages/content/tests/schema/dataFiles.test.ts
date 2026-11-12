import { describe, expect, it } from 'vitest';
import {
  confusionGroupSchema,
  confusionGroupsFileSchema,
  i18nFileSchema,
  seedFileSchema,
} from '../../src/schema/dataFiles';

const neReWa = { id: 'ね・れ・わ', items: ['kana:hira:ね', 'kana:hira:れ', 'kana:hira:わ'] };
const shiTsu = { id: 'シ・ツ', items: ['kana:kata:シ', 'kana:kata:ツ'] };
const nShiTsuSo = {
  id: 'ン・シ・ツ・ソ',
  items: ['kana:kata:ン', 'kana:kata:シ', 'kana:kata:ツ', 'kana:kata:ソ'],
};

describe('confusionGroupSchema', () => {
  it.each([
    ['a three-member group', neReWa],
    ['a two-member group', shiTsu],
    ['a four-member group', nShiTsuSo],
  ])('should accept %s', (_label, group) => {
    expect(confusionGroupSchema.safeParse(group).success).toBe(true);
  });

  it.each([
    ['an empty id', { id: '', items: ['kana:hira:ね', 'kana:hira:れ'] }],
    ['an id in decomposed (NFD) form', { id: 'が・か'.normalize('NFD'), items: ['kana:hira:ね', 'kana:hira:れ'] }],
    ['a single member', { id: 'ね', items: ['kana:hira:ね'] }],
    ['no members', { id: 'ね・れ', items: [] }],
    ['the same member twice', { id: 'ね・ね', items: ['kana:hira:ね', 'kana:hira:ね'] }],
  ])('should reject a confusion group with %s', (_label, group) => {
    expect(confusionGroupSchema.safeParse(group).success).toBe(false);
  });
});

describe('confusionGroupsFileSchema', () => {
  it('should accept an array of valid confusion groups', () => {
    expect(confusionGroupsFileSchema.safeParse([neReWa, shiTsu, nShiTsuSo]).success).toBe(true);
  });

  it('should accept an empty confusion-groups file', () => {
    expect(confusionGroupsFileSchema.safeParse([]).success).toBe(true);
  });

  it('should reject the file when one of its groups has a single member', () => {
    expect(
      confusionGroupsFileSchema.safeParse([neReWa, { id: 'ソ', items: ['kana:kata:ソ'] }]).success,
    ).toBe(false);
  });

  it('should return frozen groups arrays after a successful parse', () => {
    const groups = confusionGroupsFileSchema.parse([neReWa]);
    expect(Object.isFrozen(groups)).toBe(true);
  });
});

describe('seedFileSchema', () => {
  it('should accept a seed file with one item', () => {
    expect(seedFileSchema.safeParse({ items: ['kana:hira:ね'] }).success).toBe(true);
  });

  it.each([
    ['no items', { items: [] }],
    ['the same item twice', { items: ['kana:hira:ね', 'kana:hira:ね'] }],
  ])('should reject a seed file with %s', (_label, file) => {
    expect(seedFileSchema.safeParse(file).success).toBe(false);
  });

  it('should return a frozen items array after a successful parse', () => {
    const seed = seedFileSchema.parse({ items: ['kana:hira:ね', 'kana:hira:れ'] });
    expect(Object.isFrozen(seed.items)).toBe(true);
  });
});

describe('i18nFileSchema', () => {
  it.each([
    ['content-id and meaning keys with trimmed values', { 'vocab:n5:友達': 'teman', 'm.taberu': 'makan' }],
    ['an empty file', {}],
  ])('should accept %s', (_label, file) => {
    expect(i18nFileSchema.safeParse(file).success).toBe(true);
  });

  it.each([
    ['an empty key', { '': 'teman' }],
    ['an empty value', { k: '' }],
    ['a whitespace-only value', { k: '   ' }],
    ['a value with leading and trailing whitespace', { k: ' teman ' }],
    ['a value with only leading whitespace', { k: ' teman' }],
    ['a value in decomposed (NFD) form', { k: 'ぎんこう'.normalize('NFD') }],
  ])('should reject an i18n file with %s', (_label, file) => {
    expect(i18nFileSchema.safeParse(file).success).toBe(false);
  });
});
