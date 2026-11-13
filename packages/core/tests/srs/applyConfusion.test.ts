import {
  confusionGroupSchema,
  contentItemSchema,
  type ConfusionGroup,
  type ContentItem,
  type KanaData,
  type KanaItem,
  type VocabItem,
} from '@wara/content/schema';
import { describe, expect, it } from 'vitest';
import type { ReviewState } from '../../src/domain';
import { applyConfusion, type ConfusionAnswer } from '../../src/srs/applyConfusion';

const NOW = new Date('2026-11-13T09:00:00Z');

const kana = (
  script: KanaData['script'],
  char: string,
  romajiAccepted: ReadonlyArray<string>,
  group: KanaData['group'] = 'basic',
): KanaItem => ({
  type: 'kana',
  id: `${script === 'hiragana' ? 'kana:hira:' : 'kana:kata:'}${char}`,
  level: 'kana',
  phase: 0,
  tags: [],
  data: { char, romaji: romajiAccepted[0] ?? '', romajiAccepted, script, group },
});

const vocab = (word: string): VocabItem => ({
  type: 'vocab',
  source: 'content',
  id: `vocab:other:${word}`,
  level: 'other',
  phase: 0,
  tags: [],
  data: { word, reading: word, meaningId: `uji ${word}`, pos: 'verb', register: 'plain', examples: [] },
});

const SHI = kana('katakana', 'シ', ['shi', 'si']);
const TSU = kana('katakana', 'ツ', ['tsu', 'tu']);
const SO = kana('katakana', 'ソ', ['so']);
const N = kana('katakana', 'ン', ['n', 'nn']);
const MI = kana('katakana', 'ミ', ['mi']);
const JI = kana('katakana', 'ジ', ['ji', 'zi'], 'dakuten');
const DJI = kana('katakana', 'ヂ', ['ji', 'di'], 'dakuten');
const KA = kana('katakana', 'カ', ['ka']);
const NE = kana('hiragana', 'ね', ['ne']);
const RE = kana('hiragana', 'れ', ['re']);
const WA = kana('hiragana', 'わ', ['wa']);
const RU = kana('hiragana', 'る', ['ru']);
const NERU = vocab('ねる');
const RERU = vocab('れる');

const ITEMS: ReadonlyArray<ContentItem> = [SHI, TSU, SO, N, MI, JI, DJI, KA, NE, RE, WA, RU, NERU, RERU];

const GROUP_N_SHI_TSU_SO: ConfusionGroup = {
  id: 'ン・シ・ツ・ソ',
  items: [N.id, SHI.id, TSU.id, SO.id],
};
const GROUP_NE_RE_WA: ConfusionGroup = { id: 'ね・れ・わ', items: [NE.id, RE.id, WA.id] };
const GROUP_SHI_MI: ConfusionGroup = { id: 'シ・ミ', items: [SHI.id, MI.id] };

const GROUPS: ReadonlyArray<ConfusionGroup> = [GROUP_N_SHI_TSU_SO, GROUP_NE_RE_WA, GROUP_SHI_MI];

const reviewState = (itemId: string, due: Date, overrides: Partial<Omit<ReviewState, 'itemId' | 'due'>> = {}): ReviewState => ({
  itemId,
  stability: 4.25,
  difficulty: 6.5,
  due,
  lastReview: new Date('2026-11-10T09:00:00Z'),
  reps: 3,
  lapses: 1,
  learningSteps: 0,
  state: 'review',
  ...overrides,
});

const FUTURE = new Date('2026-11-20T09:00:00Z');
const PAST = new Date('2026-11-11T09:00:00Z');

const SHI_STATE = reviewState(SHI.id, FUTURE, { stability: 1.5, difficulty: 7.75 });
const TSU_STATE = reviewState(TSU.id, FUTURE, { stability: 12.875, difficulty: 3.125, reps: 7, lapses: 2 });
const N_STATE = reviewState(N.id, FUTURE, { stability: 9.5, difficulty: 4.5 });
const SO_STATE = reviewState(SO.id, FUTURE, { stability: 2.75, difficulty: 8.25 });
const MI_STATE = reviewState(MI.id, FUTURE, { stability: 5.5, difficulty: 5.25, state: 'relearning', learningSteps: 1 });

const NULL_RESULT = { confusedWith: null, moved: [], priorityNew: [] };

const typed = (text: string): ConfusionAnswer => ({ mode: 'typed', text });
const choice = (itemId: string): ConfusionAnswer => ({ mode: 'choice', itemId });

const run = (overrides: {
  readonly itemId?: string;
  readonly given: ConfusionAnswer;
  readonly groups?: ReadonlyArray<ConfusionGroup>;
  readonly items?: ReadonlyArray<ContentItem>;
  readonly states?: ReadonlyArray<ReviewState>;
}): ReturnType<typeof applyConfusion> =>
  applyConfusion({
    itemId: overrides.itemId ?? SHI.id,
    given: overrides.given,
    groups: overrides.groups ?? GROUPS,
    items: overrides.items ?? ITEMS,
    states: overrides.states ?? [SHI_STATE, TSU_STATE, N_STATE, SO_STATE, MI_STATE],
    now: NOW,
  });

describe('applyConfusion fixtures', () => {
  it('should build every fixture item and group as valid content', () => {
    for (const item of ITEMS) expect(contentItemSchema.safeParse(item).success).toBe(true);
    for (const group of GROUPS) expect(confusionGroupSchema.safeParse(group).success).toBe(true);
  });
});

describe('applyConfusion with a typed answer', () => {
  it('should confuse シ with ツ and move ツ to now when tsu is typed for シ', () => {
    expect(run({ given: typed('tsu') })).toEqual({
      confusedWith: TSU.id,
      moved: [{ ...TSU_STATE, due: NOW }],
      priorityNew: [],
    });
  });

  it('should accept any romajiAccepted variant of the partner when tu is typed for シ', () => {
    expect(run({ given: typed('tu') })).toEqual({
      confusedWith: TSU.id,
      moved: [{ ...TSU_STATE, due: NOW }],
      priorityNew: [],
    });
  });

  it('should match the typed text trimmed and lower-cased when " TSU " is typed for シ', () => {
    expect(run({ given: typed(' TSU ') }).confusedWith).toBe(TSU.id);
  });

  it('should return only ツ from the group of four even though ン and ソ have states', () => {
    const result = run({ given: typed('tsu') });
    expect(result.moved).toHaveLength(1);
    expect(result.moved.map((state) => state.itemId)).toEqual([TSU.id]);
    expect(result.moved.map((state) => state.itemId)).not.toContain(N.id);
    expect(result.moved.map((state) => state.itemId)).not.toContain(SO.id);
    expect(result.moved.map((state) => state.itemId)).not.toContain(SHI.id);
    expect(result.priorityNew).toEqual([]);
  });

  it('should keep the stability and difficulty of the moved partner exactly unchanged', () => {
    const [moved] = run({ given: typed('tsu') }).moved;
    expect(moved?.stability).toBe(12.875);
    expect(moved?.difficulty).toBe(3.125);
    expect(moved?.reps).toBe(7);
    expect(moved?.lapses).toBe(2);
    expect(moved?.lastReview).toEqual(TSU_STATE.lastReview);
    expect(moved?.state).toBe('review');
  });

  it('should move a partner due in the future to exactly now', () => {
    const [moved] = run({ given: typed('tsu') }).moved;
    expect(moved?.due.getTime()).toBe(NOW.getTime());
  });

  it('should keep the due of a partner already overdue and still return it in moved', () => {
    const overdueTsu = reviewState(TSU.id, PAST, { stability: 12.875, difficulty: 3.125 });
    expect(run({ given: typed('tsu'), states: [SHI_STATE, overdueTsu, N_STATE, SO_STATE] })).toEqual({
      confusedWith: TSU.id,
      moved: [overdueTsu],
      priorityNew: [],
    });
  });

  it('should keep the due of a partner due exactly now', () => {
    const dueNowTsu = reviewState(TSU.id, new Date('2026-11-13T09:00:00Z'));
    expect(run({ given: typed('tsu'), states: [SHI_STATE, dueNowTsu] })).toEqual({
      confusedWith: TSU.id,
      moved: [dueNowTsu],
      priorityNew: [],
    });
  });

  it('should return a partner without a state in priorityNew and nothing in moved when so is typed for シ', () => {
    expect(run({ given: typed('so'), states: [SHI_STATE, TSU_STATE, N_STATE] })).toEqual({
      confusedWith: SO.id,
      moved: [],
      priorityNew: [SO.id],
    });
  });

  it('should return the null result when the typed answer matches シ itself', () => {
    expect(run({ given: typed('shi') })).toEqual(NULL_RESULT);
    expect(run({ given: typed('si') })).toEqual(NULL_RESULT);
  });

  it('should return the null result when the typed answer matches no partner', () => {
    expect(run({ given: typed('ka') })).toEqual(NULL_RESULT);
  });

  it('should not confuse シ with a kana outside its groups when ne is typed', () => {
    expect(run({ given: typed('ne') })).toEqual(NULL_RESULT);
  });

  it('should consider partners from a second group and confuse シ with ミ when mi is typed', () => {
    expect(run({ given: typed('mi') })).toEqual({
      confusedWith: MI.id,
      moved: [{ ...MI_STATE, due: NOW }],
      priorityNew: [],
    });
  });

  it('should confuse with the first matching partner in group order when two partners match', () => {
    const groups: ReadonlyArray<ConfusionGroup> = [{ id: 'シ・ヂ・ジ', items: [SHI.id, DJI.id, JI.id] }];
    expect(run({ given: typed('ji'), groups, states: [] }).confusedWith).toBe(DJI.id);
    const reversed: ReadonlyArray<ConfusionGroup> = [{ id: 'シ・ジ・ヂ', items: [SHI.id, JI.id, DJI.id] }];
    expect(run({ given: typed('ji'), groups: reversed, states: [] }).confusedWith).toBe(JI.id);
  });

  it('should take the partner of the earlier group first when partners in two groups match', () => {
    const groups: ReadonlyArray<ConfusionGroup> = [
      { id: 'ジ・シ', items: [JI.id, SHI.id] },
      { id: 'シ・ヂ', items: [SHI.id, DJI.id] },
    ];
    expect(run({ given: typed('ji'), groups, states: [] })).toEqual({
      confusedWith: JI.id,
      moved: [],
      priorityNew: [JI.id],
    });
  });

  it('should ignore a superseded partner and return the null result when only it matches', () => {
    const supersededTsu: KanaItem = { ...TSU, supersededBy: SO.id };
    const items = ITEMS.map((item) => (item.id === TSU.id ? supersededTsu : item));
    const result = run({ given: typed('tsu'), items });
    expect(result).toEqual(NULL_RESULT);
    expect(result.moved.map((state) => state.itemId)).not.toContain(TSU.id);
  });

  it('should skip a superseded partner and confuse with the next matching partner', () => {
    const supersededDji: KanaItem = { ...DJI, supersededBy: JI.id };
    const items = ITEMS.map((item) => (item.id === DJI.id ? supersededDji : item));
    const groups: ReadonlyArray<ConfusionGroup> = [{ id: 'シ・ヂ・ジ', items: [SHI.id, DJI.id, JI.id] }];
    const djiState = reviewState(DJI.id, FUTURE);
    const jiState = reviewState(JI.id, FUTURE, { stability: 3.5 });
    expect(run({ given: typed('ji'), groups, items, states: [SHI_STATE, djiState, jiState] })).toEqual({
      confusedWith: JI.id,
      moved: [{ ...jiState, due: NOW }],
      priorityNew: [],
    });
  });

  it('should return the null result when the item belongs to no group', () => {
    expect(run({ itemId: KA.id, given: typed('tsu') })).toEqual(NULL_RESULT);
  });

  it('should match a vocab partner by its reading when reru is typed for ねる', () => {
    const groups: ReadonlyArray<ConfusionGroup> = [{ id: 'ねる・れる', items: [NERU.id, RERU.id] }];
    const reruState = reviewState(RERU.id, FUTURE);
    expect(run({ itemId: NERU.id, given: typed('reru'), groups, states: [reruState] })).toEqual({
      confusedWith: RERU.id,
      moved: [{ ...reruState, due: NOW }],
      priorityNew: [],
    });
  });

  it('should confuse ね with れ in the hiragana group when re is typed', () => {
    const neState = reviewState(NE.id, FUTURE);
    const reState = reviewState(RE.id, FUTURE, { stability: 0.75 });
    const waState = reviewState(WA.id, FUTURE);
    expect(run({ itemId: NE.id, given: typed('re'), states: [neState, reState, waState] })).toEqual({
      confusedWith: RE.id,
      moved: [{ ...reState, due: NOW }],
      priorityNew: [],
    });
  });
});

describe('applyConfusion with a choice answer', () => {
  it('should confuse シ with the chosen partner ツ and move it to now', () => {
    expect(run({ given: choice(TSU.id) })).toEqual({
      confusedWith: TSU.id,
      moved: [{ ...TSU_STATE, due: NOW }],
      priorityNew: [],
    });
  });

  it('should confuse シ with a chosen partner from its second group', () => {
    expect(run({ given: choice(MI.id) }).confusedWith).toBe(MI.id);
  });

  it('should return a chosen partner without a state in priorityNew', () => {
    expect(run({ given: choice(SO.id), states: [SHI_STATE] })).toEqual({
      confusedWith: SO.id,
      moved: [],
      priorityNew: [SO.id],
    });
  });

  it('should return the null result when the chosen id is the item itself', () => {
    expect(run({ given: choice(SHI.id) })).toEqual(NULL_RESULT);
  });

  it('should return the null result when the chosen id is outside the item groups', () => {
    expect(run({ given: choice(NE.id) })).toEqual(NULL_RESULT);
  });

  it('should return the null result when the chosen partner is superseded', () => {
    const supersededTsu: KanaItem = { ...TSU, supersededBy: SO.id };
    const items = ITEMS.map((item) => (item.id === TSU.id ? supersededTsu : item));
    expect(run({ given: choice(TSU.id), items })).toEqual(NULL_RESULT);
  });
});

describe('applyConfusion purity', () => {
  it('should not mutate the input states array or its objects', () => {
    const tsuDue = new Date(FUTURE.getTime());
    const tsu = reviewState(TSU.id, tsuDue);
    const states: ReadonlyArray<ReviewState> = [SHI_STATE, tsu, N_STATE];
    const snapshot = states.map((state) => ({ ...state, due: new Date(state.due.getTime()) }));
    const result = run({ given: typed('tsu'), states });
    expect(result.moved).toHaveLength(1);
    expect(states).toEqual(snapshot);
    expect(states).toHaveLength(3);
    expect(tsu.due.getTime()).toBe(FUTURE.getTime());
    expect(result.moved[0]).not.toBe(tsu);
  });

  it('should return equal results for identical inputs', () => {
    const first = run({ given: typed('tsu') });
    const second = run({ given: typed('tsu') });
    expect(first.confusedWith).toBe(TSU.id);
    expect(first).toEqual(second);
  });
});
