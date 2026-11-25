import type { ContentItem, CustomVocabItem, KanaItem, VocabItem } from '@wara/content/schema';
import { describe, expect, it } from 'vitest';
import { ContentValidationError } from '../../src/errors';
import { kanaExitWords } from '../../src/phase/kanaExitWords';
import { KANA_EXIT_WORD_COUNT } from '../../src/session/defaults';

const word = (i: number): string => `w${String(i).padStart(2, '0')}`;

const vocab = (i: number, tags: ReadonlyArray<string> = ['reading-practice']): VocabItem => ({
  type: 'vocab',
  source: 'content',
  id: `vocab:other:${word(i)}`,
  level: 'other',
  phase: 0,
  tags,
  data: { word: word(i), reading: 'ことば', meaningId: `vocab:other:${word(i)}`, pos: 'noun', register: 'plain', examples: [] },
});

const pool = (count: number, from = 0): ReadonlyArray<VocabItem> =>
  Array.from({ length: count }, (_, k) => vocab(from + k));

const ids = (items: ReadonlyArray<{ readonly id: string }>): ReadonlyArray<string> => items.map((item) => item.id);

const constantRng = (value: number): (() => number) => () => value;

const NO_SWAP = constantRng(0.999999);
const ALWAYS_FIRST = constantRng(0);

const sequenceRng = (values: ReadonlyArray<number>, fallback: number): (() => number) => {
  const queue = [...values];
  return () => queue.shift() ?? fallback;
};

const countingRng = (value: number): { readonly rng: () => number; readonly calls: () => number } => {
  const counter = { calls: 0 };
  return {
    rng: () => {
      counter.calls += 1;
      return value;
    },
    calls: () => counter.calls,
  };
};

const UNTAGGED = vocab(90, ['greeting']);
const SUPERSEDED: VocabItem = { ...vocab(91), supersededBy: 'vocab:other:w00' };
const CUSTOM: CustomVocabItem = {
  type: 'vocab',
  source: 'custom',
  id: 'vocab:custom:0f8fad5b-d9cb-469f-a165-70867728950e',
  level: 'custom',
  phase: 0,
  tags: ['reading-practice'],
  data: { word: 'ねこ', reading: 'ねこ', meaning: 'kucing' },
};
const KANA: KanaItem = {
  type: 'kana',
  id: 'kana:hira:ね',
  level: 'kana',
  phase: 0,
  tags: ['reading-practice'],
  data: { char: 'ね', romaji: 'ne', romajiAccepted: ['ne'], script: 'hiragana', group: 'basic' },
};
const EXCLUDED: ReadonlyArray<ContentItem> = [UNTAGGED, SUPERSEDED, CUSTOM, KANA];

describe('kanaExitWords — count and membership', () => {
  it('should return 50 distinct items, all from the pool, when the pool has 60', () => {
    const items = pool(60);
    const result = kanaExitWords({ items, rng: sequenceRng([0.42, 0.07, 0.93, 0.5, 0.31], 0.61) });
    expect(result).toHaveLength(KANA_EXIT_WORD_COUNT);
    expect(new Set(ids(result)).size).toBe(50);
    expect(result.every((item) => items.includes(item))).toBe(true);
  });

  it('should return all 50 items when the pool has exactly 50', () => {
    const items = pool(50);
    const result = kanaExitWords({ items, rng: sequenceRng([0.42, 0.07, 0.93], 0.61) });
    expect(result).toHaveLength(50);
    expect([...ids(result)].sort()).toEqual([...ids(items)].sort());
  });

  it('should throw ContentValidationError with issues when the pool has 49, though 49 plus one more tagged word returns 50', () => {
    const short = pool(49);
    expect(() => kanaExitWords({ items: short, rng: NO_SWAP })).toThrow(ContentValidationError);
    try {
      kanaExitWords({ items: short, rng: NO_SWAP });
      expect.unreachable();
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ContentValidationError);
      if (!(error instanceof ContentValidationError)) return;
      expect(error.issues.length).toBeGreaterThan(0);
    }
    expect(kanaExitWords({ items: [...short, vocab(49)], rng: NO_SWAP })).toHaveLength(50);
  });

  it('should throw ContentValidationError when only 49 items are eligible though excluded items bring the list to 53', () => {
    const items: ReadonlyArray<ContentItem> = [...EXCLUDED, ...pool(49)];
    expect(items).toHaveLength(53);
    expect(() => kanaExitWords({ items, rng: NO_SWAP })).toThrow(ContentValidationError);
    expect(kanaExitWords({ items: [...items, vocab(49)], rng: NO_SWAP })).toHaveLength(50);
  });
});

describe('kanaExitWords — Fisher–Yates order', () => {
  it('should return the first 50 pool items in pool order when rng never causes a swap', () => {
    const items = pool(60);
    expect(ids(kanaExitWords({ items, rng: NO_SWAP }))).toEqual(ids(pool(50)));
  });

  it('should rotate a 50-item pool left by one when rng always returns 0', () => {
    const result = ids(kanaExitWords({ items: pool(50), rng: ALWAYS_FIRST }));
    expect(result.slice(0, 3)).toEqual(['vocab:other:w01', 'vocab:other:w02', 'vocab:other:w03']);
    expect(result.slice(-3)).toEqual(['vocab:other:w48', 'vocab:other:w49', 'vocab:other:w00']);
    expect(result).toEqual([...ids(pool(49, 1)), 'vocab:other:w00']);
  });

  it('should return w01 through w50 when rng always returns 0 on a 60-item pool', () => {
    expect(ids(kanaExitWords({ items: pool(60), rng: ALWAYS_FIRST }))).toEqual(ids(pool(50, 1)));
  });

  it('should swap the last position with floor(rng × 50) on the first call when the pool has 50', () => {
    const result = ids(kanaExitWords({ items: pool(50), rng: sequenceRng([0.5], 0.999999) }));
    expect(result[25]).toBe('vocab:other:w49');
    expect(result[49]).toBe('vocab:other:w25');
    expect(result).toEqual([
      ...ids(pool(25)),
      'vocab:other:w49',
      ...ids(pool(23, 26)),
      'vocab:other:w25',
    ]);
  });

  it('should call rng exactly pool length − 1 times when the pool has 60', () => {
    const counter = countingRng(0.37);
    kanaExitWords({ items: pool(60), rng: counter.rng });
    expect(counter.calls()).toBe(59);
  });

  it('should call rng once per eligible item minus one when excluded items are mixed in', () => {
    const counter = countingRng(0.37);
    kanaExitWords({ items: [...EXCLUDED, ...pool(55)], rng: counter.rng });
    expect(counter.calls()).toBe(54);
  });
});

describe('kanaExitWords — exclusions', () => {
  it('should never return untagged, superseded, custom, or kana items when they come first in items', () => {
    const result = kanaExitWords({ items: [...EXCLUDED, ...pool(60)], rng: NO_SWAP });
    const resultIds = ids(result);
    for (const excluded of EXCLUDED) expect(resultIds).not.toContain(excluded.id);
    expect(resultIds).toEqual(ids(pool(50)));
  });

  it('should skip excluded items interleaved between eligible ones and keep the eligible items in items order', () => {
    const eligible = pool(52);
    const items: ReadonlyArray<ContentItem> = [
      ...eligible.slice(0, 10),
      UNTAGGED,
      ...eligible.slice(10, 20),
      SUPERSEDED,
      ...eligible.slice(20, 30),
      CUSTOM,
      ...eligible.slice(30, 40),
      KANA,
      ...eligible.slice(40),
    ];
    expect(ids(kanaExitWords({ items, rng: NO_SWAP }))).toEqual(ids(eligible.slice(0, 50)));
  });
});

describe('kanaExitWords — identity and purity', () => {
  it('should return the very objects from items', () => {
    const items = pool(50);
    const result = kanaExitWords({ items, rng: ALWAYS_FIRST });
    expect(result).toHaveLength(50);
    expect(result[0]).toBe(items[1]);
    expect(result[49]).toBe(items[0]);
    result.forEach((item, k) => {
      expect(item).toBe(items[(k + 1) % 50]);
    });
  });

  it('should leave items unchanged and return equal results for identical rng sequences', () => {
    const items: ReadonlyArray<ContentItem> = [...EXCLUDED, ...pool(60)];
    const order = [...items];
    const snapshot = JSON.stringify(items);
    const sequence = [0.12, 0.88, 0.45, 0.03, 0.67, 0.29, 0.94, 0.51];

    const first = kanaExitWords({ items, rng: sequenceRng(sequence, 0.73) });
    const second = kanaExitWords({ items, rng: sequenceRng(sequence, 0.73) });

    expect(JSON.stringify(items)).toBe(snapshot);
    items.forEach((item, k) => {
      expect(item).toBe(order[k]);
    });
    expect(first).toHaveLength(50);
    expect(second).toEqual(first);
    expect(ids(second)).toEqual(ids(first));
  });
});
