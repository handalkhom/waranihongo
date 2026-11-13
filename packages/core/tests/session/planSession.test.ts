import type { ContentItem, KanaItem, Phase, VocabItem } from '@wara/content/schema';
import { describe, expect, it } from 'vitest';
import type {
  ReviewState,
  Session,
  SessionActivity,
  SessionActivityKind,
  UserProfile,
} from '../../src/domain';
import {
  BACKLOG_HALVE_NEW_ABOVE,
  BACKLOG_STOP_NEW_ABOVE,
  DEFAULT_AVAILABLE_MIN,
  NEW_ITEMS_PER_DAY,
  NEW_ITEM_SEC,
  PRODUCTION_ITEM_SEC,
  REVIEW_ITEM_SEC,
  SESSION_SPLIT_MIN,
} from '../../src/session/defaults';
import { planSession } from '../../src/session/planSession';
import type { SessionPlan } from '../../src/session/planSession';

type PlanInput = Parameters<typeof planSession>[0];

const NOW = new Date('2026-11-13T09:00:00Z');
const TODAY = '2026-11-13';
const YESTERDAY = '2026-11-12';
const LARGE_MIN = 120;

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

const HIRAGANA = [
  ['あ', 'a'], ['い', 'i'], ['う', 'u'], ['え', 'e'], ['お', 'o'],
  ['か', 'ka'], ['き', 'ki'], ['く', 'ku'], ['け', 'ke'], ['こ', 'ko'],
  ['さ', 'sa'], ['し', 'shi'], ['す', 'su'], ['せ', 'se'], ['そ', 'so'],
  ['た', 'ta'], ['ち', 'chi'], ['つ', 'tsu'], ['て', 'te'], ['と', 'to'],
  ['な', 'na'], ['に', 'ni'], ['ぬ', 'nu'], ['ね', 'ne'], ['の', 'no'],
  ['は', 'ha'], ['ひ', 'hi'], ['ふ', 'fu'], ['へ', 'he'], ['ほ', 'ho'],
] as const;

const kanaItem = (char: string, romaji: string, script: KanaItem['data']['script']): KanaItem => ({
  type: 'kana',
  id: `kana:${script === 'hiragana' ? 'hira' : 'kata'}:${char}`,
  level: 'kana',
  phase: 0,
  tags: [],
  data: { char, romaji, romajiAccepted: [romaji], script, group: 'basic' },
});

const vocabItem = (word: string, reading: string, level: VocabItem['level'], phase: Phase): VocabItem => ({
  type: 'vocab',
  source: 'content',
  id: `vocab:${level}:${word}`,
  level,
  phase,
  tags: [],
  data: {
    word,
    reading,
    meaningId: `vocab:${level}:${word}`,
    pos: 'noun',
    register: 'plain',
    examples: [],
  },
});

const HIRAGANA_ITEMS: ReadonlyArray<KanaItem> = HIRAGANA.map(([char, romaji]) =>
  kanaItem(char, romaji, 'hiragana'),
);
const SO = kanaItem('ソ', 'so', 'katakana');
const N = kanaItem('ン', 'n', 'katakana');
const WE: KanaItem = { ...kanaItem('ゑ', 'we', 'hiragana'), supersededBy: 'kana:hira:え' };
const INU = vocabItem('いぬ', 'いぬ', 'other', 0);
const NEKO = vocabItem('ねこ', 'ねこ', 'other', 0);
const SAKANA = vocabItem('さかな', 'さかな', 'other', 0);
const TOMODACHI = vocabItem('友達', 'ともだち', 'n5', 1);
const NIHONGO = vocabItem('日本語', 'にほんご', 'n4', 2);
const MISSING_ID = 'kana:hira:ゐ';

const ITEMS: ReadonlyArray<ContentItem> = [
  INU,
  ...HIRAGANA_ITEMS.slice(0, 10),
  NEKO,
  ...HIRAGANA_ITEMS.slice(10),
  SO,
  N,
  TOMODACHI,
  SAKANA,
  NIHONGO,
];

const KANA_IDS: ReadonlyArray<string> = [...HIRAGANA_ITEMS, SO, N].map((item) => item.id);
const LEARNED_KANA_COUNT = KANA_IDS.length - 4;
const UNLEARNED_KANA_IDS = KANA_IDS.slice(LEARNED_KANA_COUNT);

const minutesFromNow = (minutes: number): Date => new Date(NOW.getTime() + minutes * 60_000);

const reviewState = (itemId: string, due: Date): ReviewState => ({
  itemId,
  stability: 3.2,
  difficulty: 5,
  due,
  lastReview: new Date('2026-11-10T09:00:00Z'),
  reps: 2,
  lapses: 0,
  learningSteps: 0,
  state: 'review',
});

const learned = (itemId: string): ReviewState => reviewState(itemId, minutesFromNow(24 * 60));

const profile = (weakSeeds: ReadonlyArray<string> = []): UserProfile => ({
  id: 'me',
  name: 'Alan',
  dailyTargetMin: DEFAULT_AVAILABLE_MIN,
  romajiAid: 'on-demand',
  theme: 'system',
  ttsVoiceUri: null,
  startDate: '2026-11-01',
  weakSeeds,
});

const pastActivity = (kind: SessionActivityKind, itemIds: ReadonlyArray<string>): SessionActivity => ({
  kind,
  itemIds,
  estimatedSec: itemIds.length * REVIEW_ITEM_SEC,
  done: true,
});

const session = (id: string, date: string, activities: ReadonlyArray<SessionActivity>): Session => ({
  id,
  date,
  plannedMin: DEFAULT_AVAILABLE_MIN,
  actualMin: 12,
  activities,
  cursor: 1,
  completed: false,
});

const kanaAt = (offset: number): string => String.fromCodePoint(0x3042 + offset);

const fillerItems = (count: number): ReadonlyArray<VocabItem> =>
  Array.from({ length: count }, (_, index) => {
    const word = `を${kanaAt(Math.floor(index / 80))}${kanaAt(index % 80)}`;
    return vocabItem(word, word, 'other', 0);
  });

interface Backlog {
  readonly items: ReadonlyArray<ContentItem>;
  readonly states: ReadonlyArray<ReviewState>;
  readonly mostOverdueFirst: ReadonlyArray<string>;
}

const backlog = (count: number): Backlog => {
  const fillers = fillerItems(count);
  return {
    items: [...ITEMS, ...fillers],
    states: fillers.map((item, index) => reviewState(item.id, minutesFromNow(-(index + 1)))),
    mostOverdueFirst: fillers.map((item) => item.id).reverse(),
  };
};

const input = (overrides: Partial<PlanInput> = {}): PlanInput => ({
  availableMin: DEFAULT_AVAILABLE_MIN,
  items: ITEMS,
  states: [],
  profile: profile(),
  phase: 0,
  sessionsToday: [],
  now: NOW,
  today: TODAY,
  rng: mulberry32(1),
  ...overrides,
});

const plan = (overrides: Partial<PlanInput> = {}): SessionPlan => planSession(input(overrides));

const idsOf = (result: SessionPlan, kind: SessionActivityKind): ReadonlyArray<string> =>
  result.activities.find((entry) => entry.kind === kind)?.itemIds ?? [];

const kindsOf = (result: SessionPlan): ReadonlyArray<SessionActivityKind> =>
  result.activities.map((entry) => entry.kind);

const SPLIT_TOTAL = SESSION_SPLIT_MIN.review + SESSION_SPLIT_MIN.newMaterial + SESSION_SPLIT_MIN.production;

const secondsOf = (availableMin: number): number => availableMin * 60;

const productionShareOf = (availableMin: number): number =>
  (secondsOf(availableMin) * SESSION_SPLIT_MIN.production) / SPLIT_TOTAL;

const PER_ITEM_SEC = {
  review: REVIEW_ITEM_SEC,
  new: NEW_ITEM_SEC,
  production: PRODUCTION_ITEM_SEC,
} as const satisfies Record<SessionActivityKind, number>;

const expectDrawnFrom = (drawn: ReadonlyArray<string>, pool: ReadonlyArray<string>): void => {
  expect(new Set(drawn).size).toBe(drawn.length);
  for (const id of drawn) expect(pool).toContain(id);
};

const newSlotsAtLargeMin = (dueCount: number): number =>
  Math.floor(
    (secondsOf(LARGE_MIN) - dueCount * REVIEW_ITEM_SEC - productionShareOf(LARGE_MIN)) / NEW_ITEM_SEC,
  );

describe('planSession', () => {
  it('should build plans from the documented session defaults', () => {
    expect({
      DEFAULT_AVAILABLE_MIN,
      SESSION_SPLIT_MIN,
      REVIEW_ITEM_SEC,
      NEW_ITEM_SEC,
      PRODUCTION_ITEM_SEC,
      NEW_ITEMS_PER_DAY,
      BACKLOG_HALVE_NEW_ABOVE,
      BACKLOG_STOP_NEW_ABOVE,
    }).toEqual({
      DEFAULT_AVAILABLE_MIN: 30,
      SESSION_SPLIT_MIN: { review: 5, newMaterial: 15, production: 10 },
      REVIEW_ITEM_SEC: 10,
      NEW_ITEM_SEC: 30,
      PRODUCTION_ITEM_SEC: 20,
      NEW_ITEMS_PER_DAY: { phase0: 20, later: 10 },
      BACKLOG_HALVE_NEW_ABOVE: 100,
      BACKLOG_STOP_NEW_ABOVE: 200,
    });
  });

  describe('with no review states', () => {
    it('should plan weak seeds then kana as new material and shuffle them into production when nothing has a state in phase 0', () => {
      const weakSeeds = ['kana:kata:ン', 'kana:hira:ね'];
      const result = plan({ profile: profile(weakSeeds) });
      const newCount = Math.min(
        Math.floor((secondsOf(DEFAULT_AVAILABLE_MIN) - productionShareOf(DEFAULT_AVAILABLE_MIN)) / NEW_ITEM_SEC),
        NEW_ITEMS_PER_DAY.phase0,
      );
      const expectedNew = [...weakSeeds, ...KANA_IDS.filter((id) => !weakSeeds.includes(id))].slice(0, newCount);
      const productionCount = Math.min(
        Math.floor(productionShareOf(DEFAULT_AVAILABLE_MIN) / PRODUCTION_ITEM_SEC),
        newCount,
      );

      expect(result.plannedMin).toBe(DEFAULT_AVAILABLE_MIN);
      expect(kindsOf(result)).toEqual(['new', 'production']);
      expect(result.activities[0]).toEqual({
        kind: 'new',
        itemIds: expectedNew,
        estimatedSec: newCount * NEW_ITEM_SEC,
        done: false,
      });
      expect(result.activities[1]).toMatchObject({
        kind: 'production',
        estimatedSec: productionCount * PRODUCTION_ITEM_SEC,
        done: false,
      });
      expect(idsOf(result, 'production')).toHaveLength(productionCount);
      expectDrawnFrom(idsOf(result, 'production'), expectedNew);
    });

    it('should give unused review time to new material when nothing is due', () => {
      const availableMin = 10;
      const newCount = Math.min(
        Math.floor((secondsOf(availableMin) - productionShareOf(availableMin)) / NEW_ITEM_SEC),
        NEW_ITEMS_PER_DAY.phase0,
      );
      const newShareOnly = Math.floor(
        (secondsOf(availableMin) * SESSION_SPLIT_MIN.newMaterial) / SPLIT_TOTAL / NEW_ITEM_SEC,
      );
      expect(newCount).toBeGreaterThan(newShareOnly);

      const result = plan({ availableMin });

      expect(idsOf(result, 'review')).toEqual([]);
      expect(idsOf(result, 'new')).toEqual(KANA_IDS.slice(0, newCount));
      expect(idsOf(result, 'production')).toHaveLength(
        Math.min(Math.floor(productionShareOf(availableMin) / PRODUCTION_ITEM_SEC), newCount),
      );
    });

    it('should order every kana before any vocabulary even when vocabulary comes first in the content order', () => {
      const result = plan({ states: KANA_IDS.slice(0, LEARNED_KANA_COUNT).map(learned) });

      expect(kindsOf(result)).toEqual(['new', 'production']);
      expect(idsOf(result, 'new')).toEqual([...UNLEARNED_KANA_IDS, INU.id, NEKO.id, SAKANA.id]);
    });
  });

  describe('due reviews', () => {
    const dueMix: ReadonlyArray<ReviewState> = [
      reviewState('kana:hira:う', NOW),
      reviewState('kana:hira:さ', minutesFromNow(-30)),
      reviewState('kana:hira:あ', minutesFromNow(-60)),
      reviewState('kana:hira:え', new Date(NOW.getTime() + 1)),
      reviewState('kana:hira:い', minutesFromNow(-30)),
      reviewState('kana:hira:か', minutesFromNow(-120)),
    ];

    it('should order due reviews most overdue first and break equal due times by itemId', () => {
      const result = plan({ states: dueMix });

      expect(result.activities[0]).toEqual({
        kind: 'review',
        itemIds: ['kana:hira:か', 'kana:hira:あ', 'kana:hira:い', 'kana:hira:さ', 'kana:hira:う'],
        estimatedSec: 5 * REVIEW_ITEM_SEC,
        done: false,
      });
    });

    it('should include a state due exactly at now in review', () => {
      expect(idsOf(plan({ states: dueMix }), 'review')).toContain('kana:hira:う');
    });

    it('should leave a state due one millisecond after now out of review and out of the new pool', () => {
      const result = plan({ states: dueMix });

      expect(idsOf(result, 'review')).toHaveLength(5);
      expect(idsOf(result, 'review')).not.toContain('kana:hira:え');
      expect(idsOf(result, 'new')).not.toContain('kana:hira:え');
      expect(idsOf(result, 'new')[0]).toBe('kana:hira:お');
    });

    it('should cap review at the items that fit and plan nothing else when the due list overflows the session', () => {
      const availableMin = 5;
      const cap = Math.floor(secondsOf(availableMin) / REVIEW_ITEM_SEC);
      const due = backlog(cap + 10);

      const result = plan({ availableMin, items: due.items, states: due.states });

      expect(result.activities).toEqual([
        {
          kind: 'review',
          itemIds: due.mostOverdueFirst.slice(0, cap),
          estimatedSec: cap * REVIEW_ITEM_SEC,
          done: false,
        },
      ]);
      expect(result.plannedMin).toBe(availableMin);
    });

    it('should give production only what review leaves and new material nothing when review overflows into the production share', () => {
      const availableMin = 10;
      const secs = secondsOf(availableMin);
      const dueCount = Math.floor((secs - productionShareOf(availableMin)) / REVIEW_ITEM_SEC) + 5;
      expect(dueCount * REVIEW_ITEM_SEC).toBeLessThanOrEqual(secs);
      expect(dueCount).toBeLessThanOrEqual(BACKLOG_HALVE_NEW_ABOVE);
      const productionCount = Math.floor((secs - dueCount * REVIEW_ITEM_SEC) / PRODUCTION_ITEM_SEC);
      const due = backlog(dueCount);

      const result = plan({ availableMin, items: due.items, states: due.states });

      expect(kindsOf(result)).toEqual(['review', 'production']);
      expect(idsOf(result, 'review')).toEqual(due.mostOverdueFirst);
      expect(idsOf(result, 'production')).toHaveLength(productionCount);
      expectDrawnFrom(idsOf(result, 'production'), due.mostOverdueFirst);
      expect(result.activities[1]?.estimatedSec).toBe(productionCount * PRODUCTION_ITEM_SEC);
    });

    it('should give production its full share and new material the rest when review leaves more than the production share', () => {
      const availableMin = 10;
      const secs = secondsOf(availableMin);
      const dueCount = 5;
      const newCount = Math.min(
        Math.floor((secs - dueCount * REVIEW_ITEM_SEC - productionShareOf(availableMin)) / NEW_ITEM_SEC),
        NEW_ITEMS_PER_DAY.phase0,
      );
      const productionCount = Math.min(
        Math.floor(productionShareOf(availableMin) / PRODUCTION_ITEM_SEC),
        newCount,
      );
      const due = backlog(dueCount);

      const result = plan({ availableMin, items: due.items, states: due.states });

      expect(kindsOf(result)).toEqual(['review', 'new', 'production']);
      expect(idsOf(result, 'review')).toEqual(due.mostOverdueFirst);
      expect(idsOf(result, 'new')).toEqual(KANA_IDS.slice(0, newCount));
      expect(idsOf(result, 'production')).toHaveLength(productionCount);
      expectDrawnFrom(idsOf(result, 'production'), idsOf(result, 'new'));
      expect(result.activities.map((entry) => entry.estimatedSec)).toEqual([
        dueCount * REVIEW_ITEM_SEC,
        newCount * NEW_ITEM_SEC,
        productionCount * PRODUCTION_ITEM_SEC,
      ]);
    });

    it('should leave a due state out of review when its item is superseded', () => {
      const items = [kanaItem('あ', 'a', 'hiragana'), WE, kanaItem('え', 'e', 'hiragana')];
      const result = plan({
        items,
        states: [reviewState('kana:hira:あ', minutesFromNow(-60)), reviewState(WE.id, minutesFromNow(-120))],
      });

      expect(idsOf(result, 'review')).toEqual(['kana:hira:あ']);
      expect(idsOf(result, 'new')).toEqual(['kana:hira:え']);
    });

    it('should leave a due state out of review when its item is missing from items', () => {
      const items = [kanaItem('あ', 'a', 'hiragana'), kanaItem('い', 'i', 'hiragana')];
      const result = plan({
        items,
        states: [reviewState('kana:hira:あ', minutesFromNow(-60)), reviewState(MISSING_ID, minutesFromNow(-180))],
      });

      expect(idsOf(result, 'review')).toEqual(['kana:hira:あ']);
      expect(idsOf(result, 'new')).toEqual(['kana:hira:い']);
    });
  });

  describe('new pool', () => {
    it('should leave a superseded item without a state out of the new pool', () => {
      const items = [
        kanaItem('あ', 'a', 'hiragana'),
        kanaItem('い', 'i', 'hiragana'),
        WE,
        kanaItem('え', 'e', 'hiragana'),
        NEKO,
      ];
      const result = plan({ items });

      expect(idsOf(result, 'new')).toEqual(['kana:hira:あ', 'kana:hira:い', 'kana:hira:え', NEKO.id]);
      expectDrawnFrom(idsOf(result, 'production'), idsOf(result, 'new'));
      expect(idsOf(result, 'production')).toHaveLength(4);
    });

    it('should leave the phase-1 vocabulary out of the new pool in phase 0', () => {
      const result = plan({ phase: 0, states: KANA_IDS.slice(0, LEARNED_KANA_COUNT).map(learned) });

      expect(idsOf(result, 'new')).toEqual([...UNLEARNED_KANA_IDS, INU.id, NEKO.id, SAKANA.id]);
    });

    it('should add the phase-1 vocabulary in content order in phase 1 and keep the phase-2 one out', () => {
      const result = plan({ phase: 1, states: KANA_IDS.slice(0, LEARNED_KANA_COUNT).map(learned) });

      expect(idsOf(result, 'new')).toEqual([
        ...UNLEARNED_KANA_IDS,
        INU.id,
        NEKO.id,
        TOMODACHI.id,
        SAKANA.id,
      ]);
    });

    it('should add the phase-2 vocabulary in phase 2', () => {
      const result = plan({ phase: 2, states: KANA_IDS.slice(0, LEARNED_KANA_COUNT).map(learned) });

      expect(idsOf(result, 'new')).toEqual([
        ...UNLEARNED_KANA_IDS,
        INU.id,
        NEKO.id,
        TOMODACHI.id,
        SAKANA.id,
        NIHONGO.id,
      ]);
    });
  });

  describe('weak seeds', () => {
    it('should list eligible weak seeds first in profile order, before kana and regardless of content order', () => {
      const weakSeeds = ['kana:kata:ソ', SAKANA.id, 'kana:hira:ね'];
      const result = plan({ profile: profile(weakSeeds) });

      expect(idsOf(result, 'new')).toEqual(
        [...weakSeeds, ...KANA_IDS.filter((id) => !weakSeeds.includes(id))].slice(0, NEW_ITEMS_PER_DAY.phase0),
      );
    });

    it('should skip a weak seed that already has a state', () => {
      const result = plan({
        profile: profile(['kana:kata:ン', 'kana:hira:ね']),
        states: [learned('kana:kata:ン')],
      });

      expect(idsOf(result, 'new')).toEqual(
        [
          'kana:hira:ね',
          ...KANA_IDS.filter((id) => id !== 'kana:hira:ね' && id !== 'kana:kata:ン'),
        ].slice(0, NEW_ITEMS_PER_DAY.phase0),
      );
    });

    it('should skip a superseded weak seed', () => {
      const result = plan({ items: [...ITEMS, WE], profile: profile([WE.id, 'kana:hira:ね']) });

      expect(idsOf(result, 'new')).toEqual(
        ['kana:hira:ね', ...KANA_IDS.filter((id) => id !== 'kana:hira:ね')].slice(0, NEW_ITEMS_PER_DAY.phase0),
      );
    });

    it('should skip a weak seed that is missing from items', () => {
      const result = plan({ profile: profile([MISSING_ID, 'kana:hira:ね']) });

      expect(idsOf(result, 'new')).toEqual(
        ['kana:hira:ね', ...KANA_IDS.filter((id) => id !== 'kana:hira:ね')].slice(0, NEW_ITEMS_PER_DAY.phase0),
      );
    });

    it('should skip a weak seed above the current phase and list it once that phase is reached', () => {
      const weakSeeds = [TOMODACHI.id, 'kana:hira:ね'];
      const rest = KANA_IDS.filter((id) => id !== 'kana:hira:ね');

      expect(idsOf(plan({ phase: 0, profile: profile(weakSeeds) }), 'new')).toEqual(
        ['kana:hira:ね', ...rest].slice(0, NEW_ITEMS_PER_DAY.phase0),
      );
      expect(idsOf(plan({ phase: 1, profile: profile(weakSeeds) }), 'new')).toEqual(
        [...weakSeeds, ...rest].slice(0, NEW_ITEMS_PER_DAY.later),
      );
    });
  });

  describe('new-item limit', () => {
    it('should use NEW_ITEMS_PER_DAY.later as the limit in every phase after 0', () => {
      for (const phase of [1, 2, 3] as const) {
        expect(idsOf(plan({ phase }), 'new')).toEqual(KANA_IDS.slice(0, NEW_ITEMS_PER_DAY.later));
      }
    });

    it('should keep the full limit when the due count is exactly BACKLOG_HALVE_NEW_ABOVE', () => {
      expect(newSlotsAtLargeMin(BACKLOG_HALVE_NEW_ABOVE)).toBeGreaterThanOrEqual(NEW_ITEMS_PER_DAY.phase0);
      const due = backlog(BACKLOG_HALVE_NEW_ABOVE);

      const result = plan({ availableMin: LARGE_MIN, items: due.items, states: due.states });

      expect(idsOf(result, 'review')).toEqual(due.mostOverdueFirst);
      expect(idsOf(result, 'new')).toEqual(KANA_IDS.slice(0, NEW_ITEMS_PER_DAY.phase0));
    });

    it('should halve the limit when the due count is one above BACKLOG_HALVE_NEW_ABOVE', () => {
      expect(newSlotsAtLargeMin(BACKLOG_HALVE_NEW_ABOVE + 1)).toBeGreaterThanOrEqual(NEW_ITEMS_PER_DAY.phase0);
      const due = backlog(BACKLOG_HALVE_NEW_ABOVE + 1);

      const result = plan({ availableMin: LARGE_MIN, items: due.items, states: due.states });

      expect(idsOf(result, 'review')).toHaveLength(BACKLOG_HALVE_NEW_ABOVE + 1);
      expect(idsOf(result, 'new')).toEqual(KANA_IDS.slice(0, Math.floor(NEW_ITEMS_PER_DAY.phase0 / 2)));
    });

    it('should halve the later limit in phase 1 when the due count is above BACKLOG_HALVE_NEW_ABOVE', () => {
      const due = backlog(BACKLOG_HALVE_NEW_ABOVE + 1);

      const result = plan({ phase: 1, availableMin: LARGE_MIN, items: due.items, states: due.states });

      expect(idsOf(result, 'new')).toEqual(KANA_IDS.slice(0, Math.floor(NEW_ITEMS_PER_DAY.later / 2)));
    });

    it('should not count due states of superseded or missing items toward the backlog', () => {
      const due = backlog(BACKLOG_HALVE_NEW_ABOVE);

      const result = plan({
        availableMin: LARGE_MIN,
        items: [...due.items, WE],
        states: [
          ...due.states,
          reviewState(WE.id, minutesFromNow(-1000)),
          reviewState(MISSING_ID, minutesFromNow(-1000)),
        ],
      });

      expect(idsOf(result, 'review')).toEqual(due.mostOverdueFirst);
      expect(idsOf(result, 'new')).toEqual(KANA_IDS.slice(0, NEW_ITEMS_PER_DAY.phase0));
    });

    it('should still halve rather than stop when the due count is exactly BACKLOG_STOP_NEW_ABOVE', () => {
      expect(newSlotsAtLargeMin(BACKLOG_STOP_NEW_ABOVE)).toBeGreaterThanOrEqual(NEW_ITEMS_PER_DAY.phase0);
      const due = backlog(BACKLOG_STOP_NEW_ABOVE);

      const result = plan({ availableMin: LARGE_MIN, items: due.items, states: due.states });

      expect(idsOf(result, 'new')).toEqual(KANA_IDS.slice(0, Math.floor(NEW_ITEMS_PER_DAY.phase0 / 2)));
    });

    it('should plan no new items and draw production from review when the due count is one above BACKLOG_STOP_NEW_ABOVE', () => {
      const dueCount = BACKLOG_STOP_NEW_ABOVE + 1;
      expect(dueCount * REVIEW_ITEM_SEC).toBeLessThanOrEqual(secondsOf(LARGE_MIN) - productionShareOf(LARGE_MIN));
      const due = backlog(dueCount);

      const result = plan({ availableMin: LARGE_MIN, items: due.items, states: due.states });

      expect(kindsOf(result)).toEqual(['review', 'production']);
      expect(idsOf(result, 'review')).toEqual(due.mostOverdueFirst);
      expect(idsOf(result, 'production')).toHaveLength(
        Math.min(Math.floor(productionShareOf(LARGE_MIN) / PRODUCTION_ITEM_SEC), dueCount),
      );
      expectDrawnFrom(idsOf(result, 'production'), due.mostOverdueFirst);
    });

    it('should subtract today\'s new itemIds from the halved limit', () => {
      const introducedToday = KANA_IDS.slice(0, 3);
      const due = backlog(BACKLOG_HALVE_NEW_ABOVE + 1);

      const result = plan({
        availableMin: LARGE_MIN,
        items: due.items,
        states: due.states,
        sessionsToday: [session('s-today', TODAY, [pastActivity('new', introducedToday)])],
      });

      expect(idsOf(result, 'new')).toEqual(
        KANA_IDS.slice(3, 3 + Math.floor(NEW_ITEMS_PER_DAY.phase0 / 2) - introducedToday.length),
      );
    });
  });

  describe('sessions today', () => {
    it('should subtract only the new itemIds of sessions dated today from the limit and not pick them again', () => {
      const introducedToday = KANA_IDS.slice(0, 5);
      const reviewedToday = KANA_IDS.slice(5, 9);
      const introducedYesterday = KANA_IDS.slice(25, 30);
      const withState = [...reviewedToday, ...introducedYesterday];
      const result = plan({
        states: withState.map(learned),
        sessionsToday: [
          session('s-yesterday', YESTERDAY, [pastActivity('new', introducedYesterday)]),
          session('s-today-1', TODAY, [
            pastActivity('new', introducedToday.slice(0, 3)),
            pastActivity('review', reviewedToday),
          ]),
          session('s-today-2', TODAY, [pastActivity('new', introducedToday.slice(3))]),
        ],
      });
      const excluded = new Set([...introducedToday, ...withState]);

      expect(idsOf(result, 'new')).toEqual(
        KANA_IDS.filter((id) => !excluded.has(id)).slice(0, NEW_ITEMS_PER_DAY.phase0 - introducedToday.length),
      );
    });

    it('should plan no new items and draw production from review when today\'s sessions already hold or exceed the limit', () => {
      for (const introducedCount of [NEW_ITEMS_PER_DAY.phase0, NEW_ITEMS_PER_DAY.phase0 + 5]) {
        const due = backlog(3);
        const result = plan({
          items: due.items,
          states: due.states,
          sessionsToday: [session('s-today', TODAY, [pastActivity('new', KANA_IDS.slice(0, introducedCount))])],
        });

        expect(kindsOf(result)).toEqual(['review', 'production']);
        expect(idsOf(result, 'review')).toEqual(due.mostOverdueFirst);
        expect(idsOf(result, 'production')).toHaveLength(3);
        expectDrawnFrom(idsOf(result, 'production'), due.mostOverdueFirst);
      }
    });

    it('should count sessions by the local today and not by the UTC date of now when a session crosses midnight', () => {
      const lateNow = new Date('2026-11-13T18:00:00Z');
      const introducedBeforeMidnight = KANA_IDS.slice(0, 5);
      const introducedAfterMidnight = KANA_IDS.slice(5, 8);
      const result = plan({
        now: lateNow,
        today: '2026-11-14',
        states: introducedBeforeMidnight.map(learned),
        sessionsToday: [
          session('s-13', '2026-11-13', [pastActivity('new', introducedBeforeMidnight)]),
          session('s-14', '2026-11-14', [pastActivity('new', introducedAfterMidnight)]),
        ],
      });

      expect(idsOf(result, 'new')).toEqual(
        KANA_IDS.slice(8, 8 + NEW_ITEMS_PER_DAY.phase0 - introducedAfterMidnight.length),
      );
    });
  });

  describe('time budget', () => {
    it('should plan no activity when availableMin is 0 even with due reviews and new items available', () => {
      const due = backlog(5);

      expect(plan({ availableMin: 0, items: due.items, states: due.states })).toEqual({
        plannedMin: 0,
        activities: [],
      });
    });

    it('should never plan beyond availableMin and price every activity at its per-item seconds', () => {
      const order: ReadonlyArray<SessionActivityKind> = ['review', 'new', 'production'];
      for (const availableMin of [1, 5, 10, 17, 30, 60]) {
        for (const dueCount of [0, 3, 45, 150]) {
          const due = backlog(dueCount);
          const result = plan({ availableMin, items: due.items, states: due.states });
          const kinds = kindsOf(result);

          expect(result.plannedMin).toBe(availableMin);
          expect(result.activities.length).toBeGreaterThan(0);
          expect(kinds).toEqual(order.filter((kind) => kinds.includes(kind)));
          for (const entry of result.activities) {
            expect(entry.itemIds.length).toBeGreaterThan(0);
            expect(entry.estimatedSec).toBe(entry.itemIds.length * PER_ITEM_SEC[entry.kind]);
            expect(entry.done).toBe(false);
          }
          expect(result.activities.reduce((sum, entry) => sum + entry.estimatedSec, 0)).toBeLessThanOrEqual(
            secondsOf(availableMin),
          );
        }
      }
    });
  });

  describe('determinism', () => {
    const SEEDS = [1, 7, 42, 2026, 90210];
    const scenarios: ReadonlyArray<(seed: number) => PlanInput> = [
      (seed) => input({ profile: profile(['kana:kata:ン']), rng: mulberry32(seed) }),
      (seed) => {
        const due = backlog(5);
        return input({ availableMin: 10, items: due.items, states: due.states, rng: mulberry32(seed) });
      },
      (seed) => {
        const due = backlog(45);
        return input({ availableMin: 10, items: due.items, states: due.states, rng: mulberry32(seed) });
      },
    ];

    it('should return equal plans for identical inputs with a fresh rng of the same seed', () => {
      for (const scenario of scenarios) {
        for (const seed of SEEDS) {
          const first = planSession(scenario(seed));

          expect(first.activities.length).toBeGreaterThan(0);
          expect(planSession(scenario(seed))).toEqual(first);
        }
      }
    });

    it('should let the rng seed change only the production order', () => {
      const reference = plan({ rng: mulberry32(1) });
      const productionOrders = new Set<string>();
      for (const seed of SEEDS) {
        const result = plan({ rng: mulberry32(seed) });

        expect(idsOf(result, 'review')).toEqual(idsOf(reference, 'review'));
        expect(idsOf(result, 'new')).toEqual(idsOf(reference, 'new'));
        expect([...idsOf(result, 'production')].sort()).toEqual([...idsOf(reference, 'production')].sort());
        productionOrders.add(idsOf(result, 'production').join(','));
      }

      expect(idsOf(reference, 'production').length).toBeGreaterThan(1);
      expect(productionOrders.size).toBeGreaterThan(1);
    });

    it('should leave its input arrays and dates unchanged', () => {
      const makeInput = (): PlanInput => {
        const due = backlog(5);
        return input({
          items: due.items,
          states: [...due.states].reverse(),
          profile: profile(['kana:kata:ソ', 'kana:hira:ね']),
          sessionsToday: [session('s-today', TODAY, [pastActivity('new', KANA_IDS.slice(0, 2))])],
        });
      };
      const given = makeInput();
      const pristine = makeInput();

      const result = planSession(given);

      expect(kindsOf(result)).toEqual(['review', 'new', 'production']);
      expect(given.items).toEqual(pristine.items);
      expect(given.states).toEqual(pristine.states);
      expect(given.profile).toEqual(pristine.profile);
      expect(given.sessionsToday).toEqual(pristine.sessionsToday);
      expect(given.now.getTime()).toBe(pristine.now.getTime());
    });
  });
});
