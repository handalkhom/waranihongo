import type { ContentItem, KanaData, KanaItem, VocabItem } from '@wara/content/schema';
import { describe, expect, it, vi, type Mock } from 'vitest';
import type { CardState, ReviewState } from '../../src/domain';
import { placementItems } from '../../src/session/placementItems';

const NOW = new Date('2026-11-16T09:00:00Z');

const kana = (
  script: KanaData['script'],
  char: string,
  romaji: string,
  group: KanaData['group'] = 'basic',
): KanaItem => ({
  type: 'kana',
  id: `${script === 'hiragana' ? 'kana:hira:' : 'kana:kata:'}${char}`,
  level: 'kana',
  phase: 0,
  tags: [],
  data: { char, romaji, romajiAccepted: romaji === '' ? [] : [romaji], script, group },
});

const A = kana('hiragana', 'あ', 'a');
const I = kana('hiragana', 'い', 'i');
const U = kana('hiragana', 'う', 'u');
const E = kana('hiragana', 'え', 'e');
const KA = kana('katakana', 'カ', 'ka');
const KI = kana('katakana', 'キ', 'ki');
const KU = kana('katakana', 'ク', 'ku');

const GA = kana('hiragana', 'が', 'ga', 'dakuten');
const PA = kana('hiragana', 'ぱ', 'pa', 'handakuten');
const KYA = kana('hiragana', 'きゃ', 'kya', 'combination');
const SMALL_TSU = kana('hiragana', 'っ', '', 'small');
const SMALL_YA = kana('hiragana', 'ゃ', 'ya', 'small');
const VU = kana('katakana', 'ヴ', 'vu', 'extended');
const LONG_MARK = kana('katakana', 'ー', '', 'mark');
const ITERATION_MARK = kana('hiragana', 'ゝ', 'x', 'mark');
const KATA_GA = kana('katakana', 'ガ', 'ga', 'dakuten');
const BLANK_BASIC = kana('hiragana', 'ゐ', '');
const WE: KanaItem = { ...kana('hiragana', 'ゑ', 'we'), supersededBy: E.id };

const NEKO: VocabItem = {
  type: 'vocab',
  source: 'content',
  id: 'vocab:n5:ねこ',
  level: 'n5',
  phase: 0,
  tags: [],
  data: { word: 'ねこ', reading: 'ねこ', meaningId: 'vocab:n5:ねこ', pos: 'noun', register: 'plain', examples: [] },
};

const stateOf = (itemId: string, state: CardState = 'review'): ReviewState => ({
  itemId,
  stability: state === 'new' ? 0 : 3.2,
  difficulty: 5,
  due: NOW,
  lastReview: state === 'new' ? null : new Date('2026-11-13T09:00:00Z'),
  reps: state === 'new' ? 0 : 4,
  lapses: 0,
  learningSteps: 0,
  state,
});

const keepOrder = (): number => 0.999;

const scripted = (values: ReadonlyArray<number>): Mock<() => number> => {
  const rng = vi.fn<() => number>(() => {
    throw new Error('rng dipanggil lebih banyak dari yang diharapkan');
  });
  for (const value of values) {
    rng.mockReturnValueOnce(value);
  }
  return rng;
};

const mulberry32 = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
};

const SEEDS: ReadonlyArray<number> = Array.from({ length: 20 }, (_, index) => index + 1);

const idsOf = (items: ReadonlyArray<KanaItem>): ReadonlyArray<string> => items.map((item) => item.id);

const EXCLUDED: ReadonlyArray<ContentItem> = [
  GA,
  PA,
  KYA,
  SMALL_TSU,
  SMALL_YA,
  VU,
  LONG_MARK,
  ITERATION_MARK,
  KATA_GA,
  BLANK_BASIC,
  WE,
  NEKO,
];

describe('placementItems eligibility', () => {
  it('should keep only basic kana when every other kana group is mixed in', () => {
    const items: ReadonlyArray<ContentItem> = [A, GA, PA, KYA, SMALL_YA, ITERATION_MARK, KA, KATA_GA, VU];
    expect(idsOf(placementItems({ items, states: [], rng: keepOrder }))).toEqual([A.id, KA.id]);
  });

  it.each([
    ['dakuten', GA],
    ['handakuten', PA],
    ['combination', KYA],
    ['small', SMALL_YA],
    ['extended', VU],
    ['mark', ITERATION_MARK],
  ] as const)('should exclude a drillable %s kana when it sits between two basic kana', (_group, excluded) => {
    const items: ReadonlyArray<ContentItem> = [A, excluded, I];
    expect(idsOf(placementItems({ items, states: [], rng: keepOrder }))).toEqual([A.id, I.id]);
  });

  it('should exclude a basic kana whose romaji is empty because it is not drillable', () => {
    const items: ReadonlyArray<ContentItem> = [A, BLANK_BASIC, I];
    expect(idsOf(placementItems({ items, states: [], rng: keepOrder }))).toEqual([A.id, I.id]);
  });

  it('should exclude a superseded basic kana', () => {
    const items: ReadonlyArray<ContentItem> = [A, WE, I];
    expect(idsOf(placementItems({ items, states: [], rng: keepOrder }))).toEqual([A.id, I.id]);
  });

  it('should exclude a vocab item', () => {
    const items: ReadonlyArray<ContentItem> = [A, NEKO, I];
    expect(idsOf(placementItems({ items, states: [], rng: keepOrder }))).toEqual([A.id, I.id]);
  });

  it('should exclude い when it has a review state and keep its neighbours あ and う that have none', () => {
    const items: ReadonlyArray<ContentItem> = [A, I, U];
    const states = [stateOf(I.id)];
    expect(idsOf(placementItems({ items, states, rng: keepOrder }))).toEqual([A.id, U.id]);
  });

  it('should exclude an item whose state is still new because any state counts as already met', () => {
    const items: ReadonlyArray<ContentItem> = [A, I, KA, KI];
    const states = [stateOf(A.id, 'new'), stateOf(KI.id, 'learning')];
    expect(idsOf(placementItems({ items, states, rng: keepOrder }))).toEqual([I.id, KA.id]);
  });

  it('should ignore a state whose itemId matches no item', () => {
    const items: ReadonlyArray<ContentItem> = [A, I];
    const states = [stateOf('kana:hira:ん')];
    expect(idsOf(placementItems({ items, states, rng: keepOrder }))).toEqual([A.id, I.id]);
  });

  it('should return exactly the eligible basic kana once each when every excluded kind is mixed in', () => {
    const items: ReadonlyArray<ContentItem> = [...EXCLUDED, KU, U, KA, A, KI, I];
    for (const seed of SEEDS) {
      const queue = placementItems({ items, states: [], rng: mulberry32(seed) });
      expect(queue).toHaveLength(6);
      expect(new Set(idsOf(queue)).size).toBe(6);
      expect([...idsOf(queue)].sort()).toEqual([A.id, I.id, U.id, KA.id, KI.id, KU.id].sort());
    }
  });
});

describe('placementItems empty results', () => {
  it('should return an empty queue when items is empty', () => {
    const rng = scripted([]);
    expect(placementItems({ items: [], states: [], rng })).toEqual([]);
    expect(rng).not.toHaveBeenCalled();
  });

  it('should return an empty queue when every basic kana already has a state', () => {
    const items: ReadonlyArray<ContentItem> = [A, I, KA, KI];
    const states = items.map((item) => stateOf(item.id));
    expect(placementItems({ items, states, rng: scripted([]) })).toEqual([]);
  });

  it('should return an empty queue when only excluded items are given', () => {
    expect(placementItems({ items: EXCLUDED, states: [], rng: scripted([]) })).toEqual([]);
  });
});

describe('placementItems order', () => {
  it('should put every hiragana before every katakana when the input lists katakana first', () => {
    const items: ReadonlyArray<ContentItem> = [KA, KI, KU, A, I, U];
    expect(idsOf(placementItems({ items, states: [], rng: keepOrder }))).toEqual([
      A.id,
      I.id,
      U.id,
      KA.id,
      KI.id,
      KU.id,
    ]);
  });

  it('should put every hiragana before every katakana for every seed when scripts are interleaved', () => {
    const items: ReadonlyArray<ContentItem> = [KA, A, KI, I, KU, U, E];
    for (const seed of SEEDS) {
      const scripts = placementItems({ items, states: [], rng: mulberry32(seed) }).map((item) => item.data.script);
      expect(scripts).toEqual(['hiragana', 'hiragana', 'hiragana', 'hiragana', 'katakana', 'katakana', 'katakana']);
    }
  });

  it('should keep content order inside each script when rng always returns 0.999', () => {
    const items: ReadonlyArray<ContentItem> = [KA, A, KI, I, KU, U];
    expect(idsOf(placementItems({ items, states: [], rng: keepOrder }))).toEqual([
      A.id,
      I.id,
      U.id,
      KA.id,
      KI.id,
      KU.id,
    ]);
  });

  it('should turn あいう into いうあ and カキク into キクカ when rng always returns 0', () => {
    const items: ReadonlyArray<ContentItem> = [A, I, U, KA, KI, KU];
    expect(idsOf(placementItems({ items, states: [], rng: () => 0 }))).toEqual([
      I.id,
      U.id,
      A.id,
      KI.id,
      KU.id,
      KA.id,
    ]);
  });

  it('should turn あいうえ into えいあう with Fisher–Yates from the end when rng yields 0.5, 0.2, 0.9', () => {
    const items: ReadonlyArray<ContentItem> = [A, I, U, E];
    expect(idsOf(placementItems({ items, states: [], rng: scripted([0.5, 0.2, 0.9]) }))).toEqual([
      E.id,
      I.id,
      A.id,
      U.id,
    ]);
  });

  it('should turn カキク into クカキ when rng yields 0.4 then 0.1', () => {
    const items: ReadonlyArray<ContentItem> = [KA, KI, KU];
    expect(idsOf(placementItems({ items, states: [], rng: scripted([0.4, 0.1]) }))).toEqual([
      KU.id,
      KA.id,
      KI.id,
    ]);
  });

  it('should shuffle hiragana with the first rng values and katakana with the rest', () => {
    const items: ReadonlyArray<ContentItem> = [KA, KI, KU, A, I, U];
    expect(idsOf(placementItems({ items, states: [], rng: scripted([0, 0, 0.999, 0.999]) }))).toEqual([
      I.id,
      U.id,
      A.id,
      KA.id,
      KI.id,
      KU.id,
    ]);
  });

  it('should shuffle katakana with the last rng values when hiragana consume the first ones', () => {
    const items: ReadonlyArray<ContentItem> = [A, I, U, KA, KI, KU];
    expect(idsOf(placementItems({ items, states: [], rng: scripted([0.999, 0.999, 0, 0]) }))).toEqual([
      A.id,
      I.id,
      U.id,
      KI.id,
      KU.id,
      KA.id,
    ]);
  });

  it('should shuffle only the eligible items, skipping a stated item before counting positions', () => {
    const items: ReadonlyArray<ContentItem> = [A, I, U, E];
    const states = [stateOf(I.id)];
    expect(idsOf(placementItems({ items, states, rng: () => 0 }))).toEqual([U.id, E.id, A.id]);
  });
});

describe('placementItems rng use', () => {
  it('should call rng (hiragana - 1) + (katakana - 1) times when four hiragana and three katakana are eligible', () => {
    const rng = vi.fn<() => number>(() => 0.5);
    const items: ReadonlyArray<ContentItem> = [A, I, U, E, KA, KI, KU, ...EXCLUDED];
    expect(placementItems({ items, states: [], rng })).toHaveLength(7);
    expect(rng).toHaveBeenCalledTimes(5);
  });

  it('should not call rng when each script has exactly one eligible item', () => {
    const rng = scripted([]);
    const items: ReadonlyArray<ContentItem> = [KA, A, GA, VU];
    expect(idsOf(placementItems({ items, states: [], rng }))).toEqual([A.id, KA.id]);
    expect(rng).not.toHaveBeenCalled();
  });

  it('should call rng once when only two katakana are eligible and no hiragana', () => {
    const rng = scripted([0]);
    const items: ReadonlyArray<ContentItem> = [KA, KI, GA];
    expect(idsOf(placementItems({ items, states: [], rng }))).toEqual([KI.id, KA.id]);
    expect(rng).toHaveBeenCalledTimes(1);
  });
});

describe('placementItems determinism and purity', () => {
  it('should return the same queue twice for the same inputs and the same seed', () => {
    const items: ReadonlyArray<ContentItem> = [KA, A, KI, I, KU, U, E, ...EXCLUDED];
    for (const seed of SEEDS) {
      const first = placementItems({ items, states: [], rng: mulberry32(seed) });
      const second = placementItems({ items, states: [], rng: mulberry32(seed) });
      expect(first).toHaveLength(7);
      expect(first).toEqual(second);
    }
  });

  it('should let the seed change the hiragana order across seeds', () => {
    const items: ReadonlyArray<ContentItem> = [A, I, U, E];
    const orders = SEEDS.map((seed) => idsOf(placementItems({ items, states: [], rng: mulberry32(seed) })).join(','));
    expect(orders.every((order) => order.split(',').length === 4)).toBe(true);
    expect(new Set(orders).size).toBeGreaterThan(1);
  });

  it('should leave frozen items and states unchanged and return the original item objects', () => {
    const frozenKana = (item: KanaItem): KanaItem => Object.freeze({ ...item, data: Object.freeze({ ...item.data }) });
    const items: ReadonlyArray<ContentItem> = Object.freeze([
      ...[KA, KI, KU, A, I, U, E].map(frozenKana),
      Object.freeze({ ...NEKO }),
      frozenKana(GA),
    ]);
    const states: ReadonlyArray<ReviewState> = Object.freeze([Object.freeze(stateOf(E.id))]);
    const queue = placementItems({ items, states, rng: () => 0 });
    expect(idsOf(queue)).toEqual([I.id, U.id, A.id, KI.id, KU.id, KA.id]);
    expect(items.map((item) => item.id)).toEqual([KA.id, KI.id, KU.id, A.id, I.id, U.id, E.id, NEKO.id, GA.id]);
    expect(states).toEqual([stateOf(E.id)]);
    expect(queue.every((item) => items.includes(item))).toBe(true);
  });
});
