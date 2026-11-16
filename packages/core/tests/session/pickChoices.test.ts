import {
  kanaItemSchema,
  vocabItemSchema,
  confusionGroupSchema,
  type ConfusionGroup,
  type ContentItem,
  type KanaData,
  type KanaItem,
  type VocabItem,
} from '@wara/content/schema';
import { describe, expect, it } from 'vitest';
import { pickChoices } from '../../src/session/pickChoices';

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

const kana = (
  script: KanaData['script'],
  char: string,
  romajiAccepted: ReadonlyArray<string>,
  group: KanaData['group'] = 'basic',
): KanaItem =>
  kanaItemSchema.parse({
    type: 'kana',
    id: `${script === 'hiragana' ? 'kana:hira:' : 'kana:kata:'}${char}`,
    level: 'kana',
    phase: 0,
    tags: [],
    data: { char, romaji: romajiAccepted[0] ?? '', romajiAccepted, script, group },
  });

const hira = (char: string, romajiAccepted: ReadonlyArray<string>, group: KanaData['group'] = 'basic'): KanaItem =>
  kana('hiragana', char, romajiAccepted, group);

const kata = (char: string, romajiAccepted: ReadonlyArray<string>, group: KanaData['group'] = 'basic'): KanaItem =>
  kana('katakana', char, romajiAccepted, group);

const A = hira('あ', ['a']);
const I = hira('い', ['i']);
const U = hira('う', ['u']);
const E = hira('え', ['e']);
const O = hira('お', ['o']);
const KA = hira('か', ['ka']);
const KI = hira('き', ['ki']);
const KU = hira('く', ['ku']);
const KE = hira('け', ['ke']);
const KO = hira('こ', ['ko']);
const NE = hira('ね', ['ne']);
const RE = hira('れ', ['re']);
const WA = hira('わ', ['wa']);
const RU = hira('る', ['ru']);
const WO = hira('を', ['o', 'wo']);
const TSU = hira('つ', ['tsu', 'tu']);
const N = hira('ん', ['n', 'nn']);
const JI = hira('じ', ['ji', 'zi'], 'dakuten');
const DJI = hira('ぢ', ['ji', 'di'], 'dakuten');
const ZU = hira('ず', ['zu'], 'dakuten');
const DZU = hira('づ', ['zu', 'du'], 'dakuten');
const GA = hira('が', ['ga'], 'dakuten');
const PA = hira('ぱ', ['pa'], 'handakuten');
const PI = hira('ぴ', ['pi'], 'handakuten');
const SMALL_TSU = hira('っ', [], 'small');
const WE: KanaItem = kanaItemSchema.parse({ ...hira('ゑ', ['we']), supersededBy: E.id });

const KATA_N = kata('ン', ['n', 'nn']);
const KATA_SHI = kata('シ', ['shi', 'si']);
const KATA_TSU = kata('ツ', ['tsu', 'tu']);
const KATA_SO = kata('ソ', ['so']);
const KATA_MI = kata('ミ', ['mi']);
const KATA_KA = kata('カ', ['ka']);
const KATA_KI = kata('キ', ['ki']);
const KATA_KU = kata('ク', ['ku']);
const KATA_SMALL_TSU = kata('ッ', [], 'small');
const LONG_MARK = kata('ー', [], 'mark');

const NEKO: VocabItem = vocabItemSchema.parse({
  type: 'vocab',
  source: 'content',
  id: 'vocab:n5:ねこ',
  level: 'n5',
  phase: 0,
  tags: [],
  data: { word: 'ねこ', reading: 'ねこ', meaningId: 'kucing', pos: 'noun', register: 'plain', examples: [] },
});

const HIRAGANA: ReadonlyArray<KanaItem> = [
  A, I, U, E, O, KA, KI, KU, KE, KO, NE, RE, WA, RU, WO, TSU, N, JI, DJI, ZU, DZU, GA, PA, PI, SMALL_TSU, WE,
];
const KATAKANA: ReadonlyArray<KanaItem> = [
  KATA_N, KATA_SHI, KATA_TSU, KATA_SO, KATA_MI, KATA_KA, KATA_KI, KATA_KU, KATA_SMALL_TSU, LONG_MARK,
];
const ITEMS: ReadonlyArray<ContentItem> = [...HIRAGANA, NEKO, ...KATAKANA];

const group = (id: string, members: ReadonlyArray<KanaItem>): ConfusionGroup =>
  confusionGroupSchema.parse({ id, items: members.map((member) => member.id) });

const GROUP_NE_RE_WA = group('ね・れ・わ', [NE, RE, WA]);
const GROUP_N_SHI_TSU_SO = group('ン・シ・ツ・ソ', [KATA_N, KATA_SHI, KATA_TSU, KATA_SO]);
const GROUP_SHI_MI = group('シ・ミ', [KATA_SHI, KATA_MI]);
const GROUP_SMALL_TSU_TSU = group('っ・つ', [SMALL_TSU, TSU]);
const GROUP_JI_DJI = group('じ・ぢ', [JI, DJI]);

const GROUPS: ReadonlyArray<ConfusionGroup> = [
  GROUP_NE_RE_WA,
  GROUP_N_SHI_TSU_SO,
  GROUP_SHI_MI,
  GROUP_SMALL_TSU_TSU,
  GROUP_JI_DJI,
];

const pick = (overrides: {
  readonly item: KanaItem;
  readonly count: number;
  readonly items?: ReadonlyArray<ContentItem>;
  readonly groups?: ReadonlyArray<ConfusionGroup>;
  readonly seed?: number;
}): ReadonlyArray<KanaItem> =>
  pickChoices({
    item: overrides.item,
    items: overrides.items ?? ITEMS,
    groups: overrides.groups ?? GROUPS,
    count: overrides.count,
    rng: mulberry32(overrides.seed ?? 1),
  });

const idsOf = (choices: ReadonlyArray<KanaItem>): ReadonlyArray<string> => choices.map((choice) => choice.id);

const sortedIds = (choices: ReadonlyArray<KanaItem>): ReadonlyArray<string> => [...idsOf(choices)].sort();

const sortedIdsOf = (items: ReadonlyArray<KanaItem>): ReadonlyArray<string> => [...idsOf(items)].sort();

const occurrences = (choices: ReadonlyArray<KanaItem>, item: KanaItem): number =>
  choices.filter((choice) => choice.id === item.id).length;

describe('pickChoices with confusion partners', () => {
  it('should include ね once with both partners れ and わ and one more basic hiragana when ね asks for four choices', () => {
    for (const seed of SEEDS) {
      const choices = pick({ item: NE, count: 4, seed });
      expect(choices).toHaveLength(4);
      expect(occurrences(choices, NE)).toBe(1);
      expect(idsOf(choices)).toEqual(expect.arrayContaining([NE.id, RE.id, WA.id]));
      const [extra] = choices.filter((choice) => ![NE.id, RE.id, WA.id].includes(choice.id));
      expect(extra?.data.script).toBe('hiragana');
      expect(extra?.data.group).toBe('basic');
    }
  });

  it('should return exactly ね, れ and わ for every seed when ね asks for three choices', () => {
    for (const seed of SEEDS) {
      expect(sortedIds(pick({ item: NE, count: 3, seed }))).toEqual(sortedIdsOf([NE, RE, WA]));
    }
  });

  it('should take ン and ツ, the first two partners in member order, when シ of the group of four asks for three choices', () => {
    for (const seed of SEEDS) {
      expect(sortedIds(pick({ item: KATA_SHI, count: 3, seed }))).toEqual(sortedIdsOf([KATA_SHI, KATA_N, KATA_TSU]));
    }
  });

  it('should take every partner of the earlier group before ミ of the later group when シ asks for four choices', () => {
    for (const seed of SEEDS) {
      expect(sortedIds(pick({ item: KATA_SHI, count: 4, seed }))).toEqual(
        sortedIdsOf([KATA_SHI, KATA_N, KATA_TSU, KATA_SO]),
      );
    }
  });

  it('should add ミ from the later group before any non-partner when シ asks for five choices', () => {
    for (const seed of SEEDS) {
      expect(sortedIds(pick({ item: KATA_SHI, count: 5, seed }))).toEqual(
        sortedIdsOf([KATA_SHI, KATA_N, KATA_TSU, KATA_SO, KATA_MI]),
      );
    }
  });

  it('should take ミ first when the group order puts シ・ミ before the group of four and シ asks for two choices', () => {
    for (const seed of SEEDS) {
      const choices = pick({ item: KATA_SHI, count: 2, groups: [GROUP_SHI_MI, GROUP_N_SHI_TSU_SO], seed });
      expect(sortedIds(choices)).toEqual(sortedIdsOf([KATA_SHI, KATA_MI]));
    }
  });

  it('should prefer a partner from another kana group over same-group kana when ね is grouped with ぱ', () => {
    const groups = [group('ね・ぱ', [NE, PA])];
    for (const seed of SEEDS) {
      expect(sortedIds(pick({ item: NE, count: 2, groups, seed }))).toEqual(sortedIdsOf([NE, PA]));
    }
  });

  it('should skip a superseded partner ツ and take ソ next when シ asks for three choices', () => {
    const supersededTsu: KanaItem = { ...KATA_TSU, supersededBy: KATA_SO.id };
    const items = ITEMS.map((item) => (item.id === KATA_TSU.id ? supersededTsu : item));
    for (const seed of SEEDS) {
      expect(sortedIds(pick({ item: KATA_SHI, count: 3, items, seed }))).toEqual(
        sortedIdsOf([KATA_SHI, KATA_N, KATA_SO]),
      );
    }
  });

  it('should skip a partner id missing from items and take the next partner of the group', () => {
    const groups: ReadonlyArray<ConfusionGroup> = [
      confusionGroupSchema.parse({ id: 'ね・ぬ・れ', items: [NE.id, 'kana:hira:ぬ', RE.id] }),
    ];
    for (const seed of SEEDS) {
      expect(sortedIds(pick({ item: NE, count: 2, groups, seed }))).toEqual(sortedIdsOf([NE, RE]));
    }
  });

  it('should never return っ for つ even though they share a confusion group', () => {
    for (const seed of SEEDS) {
      const choices = pick({ item: TSU, count: 4, seed });
      expect(choices).toHaveLength(4);
      expect(occurrences(choices, TSU)).toBe(1);
      expect(idsOf(choices)).not.toContain(SMALL_TSU.id);
    }
  });

  it('should never return ぢ for じ even though they share a confusion group, because both read ji', () => {
    for (const seed of SEEDS) {
      const choices = pick({ item: JI, count: 99, seed });
      expect(occurrences(choices, JI)).toBe(1);
      expect(idsOf(choices)).not.toContain(DJI.id);
    }
  });
});

describe('pickChoices pool filtering', () => {
  it('should give カ only katakana choices even when a group pairs it with hiragana ね', () => {
    const groups = [...GROUPS, group('カ・ね', [KATA_KA, NE])];
    for (const seed of SEEDS) {
      const choices = pick({ item: KATA_KA, count: 99, groups, seed });
      expect(sortedIds(choices)).toEqual(
        sortedIdsOf([KATA_N, KATA_SHI, KATA_TSU, KATA_SO, KATA_MI, KATA_KA, KATA_KI, KATA_KU]),
      );
      expect(choices.every((choice) => choice.data.script === 'katakana')).toBe(true);
    }
  });

  it('should give ね only hiragana choices when the pool also holds katakana', () => {
    for (const seed of SEEDS) {
      const choices = pick({ item: NE, count: 8, seed });
      expect(choices).toHaveLength(8);
      expect(choices.every((choice) => choice.data.script === 'hiragana')).toBe(true);
    }
  });

  it('should never return two choices sharing a romaji, keeping one of お/を, じ/ぢ and ず/づ, when あ asks for every choice', () => {
    for (const seed of SEEDS) {
      const choices = pick({ item: A, count: 99, seed });
      expect(choices).toHaveLength(21);
      expect(new Set(choices.map((choice) => choice.data.romaji)).size).toBe(21);
      expect(choices.filter((choice) => choice.id === O.id || choice.id === WO.id)).toHaveLength(1);
      expect(choices.filter((choice) => choice.id === JI.id || choice.id === DJI.id)).toHaveLength(1);
      expect(choices.filter((choice) => choice.id === ZU.id || choice.id === DZU.id)).toHaveLength(1);
    }
  });

  it('should never return お or を for each other since both read o', () => {
    for (const seed of SEEDS) {
      expect(idsOf(pick({ item: O, count: 99, seed }))).not.toContain(WO.id);
      expect(idsOf(pick({ item: WO, count: 99, seed }))).not.toContain(O.id);
      expect(pick({ item: WO, count: 99, seed })).toHaveLength(21);
    }
  });

  it('should never return っ, a superseded ゑ, or a vocab item when ね asks for every choice', () => {
    for (const seed of SEEDS) {
      const choices = pick({ item: NE, count: 99, seed });
      expect(choices).toHaveLength(21);
      expect(idsOf(choices)).not.toContain(SMALL_TSU.id);
      expect(idsOf(choices)).not.toContain(WE.id);
      expect(idsOf(choices)).not.toContain(NEKO.id);
    }
  });

  it('should never return ッ or ー when ソ asks for every choice', () => {
    for (const seed of SEEDS) {
      const choices = pick({ item: KATA_SO, count: 99, seed });
      expect(choices).toHaveLength(8);
      expect(idsOf(choices)).not.toContain(KATA_SMALL_TSU.id);
      expect(idsOf(choices)).not.toContain(LONG_MARK.id);
    }
  });

  it('should return the whole drillable pool plus ね when count exceeds the pool', () => {
    const items: ReadonlyArray<ContentItem> = [NE, RE, WA, RU, SMALL_TSU, WE, NEKO, KATA_KA];
    for (const seed of SEEDS) {
      expect(sortedIds(pick({ item: NE, count: 10, items, seed }))).toEqual(sortedIdsOf([NE, RE, WA, RU]));
    }
  });

  it('should return only the item when the pool holds no distractor', () => {
    expect(idsOf(pick({ item: NE, count: 4, items: [NE, SMALL_TSU, NEKO, KATA_KA] }))).toEqual([NE.id]);
  });

  it('should return only the item when count is one', () => {
    for (const seed of SEEDS) {
      expect(idsOf(pick({ item: NE, count: 1, seed }))).toEqual([NE.id]);
    }
  });

  it('should include the item exactly once even when items does not contain it', () => {
    const items = ITEMS.filter((item) => item.id !== NE.id);
    for (const seed of SEEDS) {
      const choices = pick({ item: NE, count: 4, items, seed });
      expect(choices).toHaveLength(4);
      expect(occurrences(choices, NE)).toBe(1);
      expect(idsOf(choices)).toEqual(expect.arrayContaining([RE.id, WA.id]));
    }
  });
});

describe('pickChoices same-group preference', () => {
  it('should take every distractor of partner-less か from basic hiragana when enough exist', () => {
    for (const seed of SEEDS) {
      const choices = pick({ item: KA, count: 4, seed });
      expect(choices).toHaveLength(4);
      expect(occurrences(choices, KA)).toBe(1);
      expect(choices.every((choice) => choice.data.group === 'basic' && choice.data.script === 'hiragana')).toBe(true);
    }
  });

  it('should fill the choices of が with one ji kana and one zu kana from dakuten before any other group', () => {
    for (const seed of SEEDS) {
      const choices = pick({ item: GA, count: 3, groups: [], seed });
      expect(choices).toHaveLength(3);
      expect(choices.every((choice) => choice.data.group === 'dakuten')).toBe(true);
      expect([...choices.map((choice) => choice.data.romaji)].sort()).toEqual(['ga', 'ji', 'zu']);
    }
  });

  it('should always take ぴ for ぱ and fill the rest from other hiragana groups when handakuten runs out', () => {
    for (const seed of SEEDS) {
      const choices = pick({ item: PA, count: 4, seed });
      expect(choices).toHaveLength(4);
      expect(idsOf(choices)).toContain(PI.id);
      expect(choices.filter((choice) => choice.data.group === 'handakuten')).toHaveLength(2);
      expect(choices.every((choice) => choice.data.script === 'hiragana')).toBe(true);
    }
  });
});

describe('pickChoices rng use and determinism', () => {
  it('should shuffle the position of the item with rng so it is not always in the same slot', () => {
    const positions = SEEDS.map((seed) => idsOf(pick({ item: NE, count: 4, seed })).indexOf(NE.id));
    expect(positions.every((position) => position >= 0 && position < 4)).toBe(true);
    expect(new Set(positions).size).toBeGreaterThan(1);
  });

  it('should let rng vary the same-group distractor of か across seeds', () => {
    const distractors = SEEDS.map((seed) => idsOf(pick({ item: KA, count: 2, seed })).find((id) => id !== KA.id));
    expect(distractors.every((id) => id !== undefined)).toBe(true);
    expect(new Set(distractors).size).toBeGreaterThan(1);
  });

  it('should return identical choices in identical order for the same inputs and the same seed', () => {
    for (const seed of SEEDS) {
      const first = pick({ item: KA, count: 4, seed });
      const second = pick({ item: KA, count: 4, seed });
      expect(first).toHaveLength(4);
      expect(idsOf(first)).toEqual(idsOf(second));
    }
  });

  it('should return exactly count choices when the pool allows it', () => {
    for (const count of [2, 3, 4, 5, 6]) {
      expect(pick({ item: KATA_KA, count })).toHaveLength(count);
      expect(pick({ item: E, count })).toHaveLength(count);
    }
  });
});
