import type { ConfusionGroup, ContentItem, KanaItem } from '@wara/content/schema';
import { describe, expect, it } from 'vitest';
import { rateAnswer } from '../../src/answer/rateAnswer';
import { RATING, type Rating, type ReviewState } from '../../src/domain';
import { applyConfusion, type ConfusionAnswer } from '../../src/srs/applyConfusion';
import { gradeAnswer, type GradedAnswer } from '../../src/srs/gradeAnswer';
import { schedule } from '../../src/srs/schedule';

const NOW = new Date('2026-11-13T09:00:00Z');
const FUTURE = new Date('2026-11-20T09:00:00Z');
const LOG_ID = 'log-0001';

const hira = (char: string, romajiAccepted: ReadonlyArray<string>): KanaItem => ({
  type: 'kana',
  id: `kana:hira:${char}`,
  level: 'kana',
  phase: 0,
  tags: [],
  data: { char, romaji: romajiAccepted[0] ?? '', romajiAccepted, script: 'hiragana', group: 'basic' },
});

const NE = hira('ね', ['ne']);
const RE = hira('れ', ['re']);
const WA = hira('わ', ['wa']);
const KA = hira('か', ['ka']);

const ITEMS: ReadonlyArray<ContentItem> = [NE, RE, WA, KA];
const GROUPS: ReadonlyArray<ConfusionGroup> = [{ id: 'ね・れ・わ', items: [NE.id, RE.id, WA.id] }];

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

const NE_STATE = reviewState(NE.id, NOW, { stability: 9.5, difficulty: 4.5, reps: 5, lapses: 0 });
const RE_STATE = reviewState(RE.id, FUTURE, { stability: 0.75 });
const WA_STATE = reviewState(WA.id, FUTURE, { stability: 12.875, difficulty: 3.125 });

const typed = (text: string): ConfusionAnswer => ({ mode: 'typed', text });
const choice = (itemId: string): ConfusionAnswer => ({ mode: 'choice', itemId });

interface Args {
  readonly itemId: string;
  readonly correct: boolean;
  readonly given: ConfusionAnswer;
  readonly elapsedMs: number;
  readonly states: ReadonlyArray<ReviewState>;
  readonly weakSeeds: ReadonlyArray<string>;
}

const BASE: Args = {
  itemId: NE.id,
  correct: true,
  given: typed('ne'),
  elapsedMs: 1000,
  states: [NE_STATE, RE_STATE, WA_STATE],
  weakSeeds: [],
};

const grade = (overrides: Partial<Args>): GradedAnswer => {
  const args = { ...BASE, ...overrides };
  return gradeAnswer({ ...args, groups: GROUPS, items: ITEMS, now: NOW, logId: LOG_ID });
};

const scheduled = (args: Args, rating: Rating): ReviewState =>
  schedule({
    itemId: args.itemId,
    state: args.states.find((state) => state.itemId === args.itemId) ?? null,
    rating,
    now: NOW,
    weakSeeds: args.weakSeeds,
  });

const composed = (overrides: Partial<Args>): GradedAnswer => {
  const args = { ...BASE, ...overrides };
  const rating = rateAnswer({ correct: args.correct, elapsedMs: args.elapsedMs, mode: args.given.mode });
  const confusion = args.correct
    ? { confusedWith: null, moved: [], priorityNew: [] }
    : applyConfusion({ itemId: args.itemId, given: args.given, groups: GROUPS, items: ITEMS, states: args.states, now: NOW });
  return {
    states: [scheduled(args, rating), ...confusion.moved],
    log: { id: LOG_ID, itemId: args.itemId, at: NOW, rating, elapsedMs: args.elapsedMs, confusedWith: confusion.confusedWith },
    confusedWith: confusion.confusedWith,
    priorityNew: confusion.priorityNew,
  };
};

describe('gradeAnswer rating', () => {
  it('should log Easy and return the Easy schedule when a typed answer is correct and fast', () => {
    const overrides: Partial<Args> = { correct: true, given: typed('ne'), elapsedMs: 1000 };
    const result = grade(overrides);
    expect(result.log.rating).toBe(RATING.easy);
    expect(result.states).toEqual([scheduled({ ...BASE, ...overrides }, RATING.easy)]);
    expect(result.confusedWith).toBeNull();
    expect(result.priorityNew).toEqual([]);
    expect(result).toEqual(composed(overrides));
  });

  it('should log Good and return the Good schedule when a typed answer is correct within the Good window', () => {
    const overrides: Partial<Args> = { correct: true, given: typed('ne'), elapsedMs: 4000 };
    const result = grade(overrides);
    expect(result.log.rating).toBe(RATING.good);
    expect(result.states).toEqual([scheduled({ ...BASE, ...overrides }, RATING.good)]);
  });

  it('should log Hard and return the Hard schedule when a choice answer is correct but slow', () => {
    const overrides: Partial<Args> = { correct: true, given: choice(NE.id), elapsedMs: 5000 };
    const result = grade(overrides);
    expect(result.log.rating).toBe(RATING.hard);
    expect(result.states).toEqual([scheduled({ ...BASE, ...overrides }, RATING.hard)]);
    expect(result).toEqual(composed(overrides));
  });

  it('should log Good, never Easy, when a choice answer is correct and fast', () => {
    const overrides: Partial<Args> = { correct: true, given: choice(NE.id), elapsedMs: 1000 };
    const result = grade(overrides);
    expect(result.log.rating).toBe(RATING.good);
    expect(result.states).toEqual([scheduled({ ...BASE, ...overrides }, RATING.good)]);
  });

  it('should log Again and return the Again schedule when a typed answer is wrong even if fast', () => {
    const overrides: Partial<Args> = { correct: false, given: typed('ka'), elapsedMs: 500 };
    const result = grade(overrides);
    expect(result.log.rating).toBe(RATING.again);
    expect(result.states).toEqual([scheduled({ ...BASE, ...overrides }, RATING.again)]);
  });
});

describe('gradeAnswer confusion', () => {
  it('should rate Again, confuse ね with れ, and return ね first and れ moved to now when re is typed for ね', () => {
    const overrides: Partial<Args> = { correct: false, given: typed('re'), elapsedMs: 3000 };
    const result = grade(overrides);
    expect(result.log.rating).toBe(RATING.again);
    expect(result.confusedWith).toBe(RE.id);
    expect(result.log.confusedWith).toBe(RE.id);
    expect(result.states).toEqual([scheduled({ ...BASE, ...overrides }, RATING.again), { ...RE_STATE, due: NOW }]);
    expect(result.states.map((state) => state.itemId)).toEqual([NE.id, RE.id]);
    expect(result.states[1]?.due.getTime()).toBe(NOW.getTime());
    expect(result.priorityNew).toEqual([]);
    expect(result).toEqual(composed(overrides));
  });

  it('should confuse ね with the chosen れ when a choice answer picks れ', () => {
    const overrides: Partial<Args> = { correct: false, given: choice(RE.id), elapsedMs: 2000 };
    const result = grade(overrides);
    expect(result.confusedWith).toBe(RE.id);
    expect(result.log.rating).toBe(RATING.again);
    expect(result).toEqual(composed(overrides));
  });

  it('should put a partner without a state in priorityNew and return only ね when re is typed and れ has no state', () => {
    const overrides: Partial<Args> = { correct: false, given: typed('re'), states: [NE_STATE, WA_STATE] };
    const result = grade(overrides);
    expect(result.confusedWith).toBe(RE.id);
    expect(result.log.confusedWith).toBe(RE.id);
    expect(result.priorityNew).toEqual([RE.id]);
    expect(result.states).toEqual([scheduled({ ...BASE, ...overrides }, RATING.again)]);
    expect(result).toEqual(composed(overrides));
  });

  it('should leave confusedWith null and return only ね when a wrong typed answer matches no partner', () => {
    const overrides: Partial<Args> = { correct: false, given: typed('ka') };
    const result = grade(overrides);
    expect(result.confusedWith).toBeNull();
    expect(result.log.confusedWith).toBeNull();
    expect(result.priorityNew).toEqual([]);
    expect(result.states).toEqual([scheduled({ ...BASE, ...overrides }, RATING.again)]);
    expect(result.log.itemId).toBe(NE.id);
  });

  it('should not consult confusion when the answer is marked correct even if the given text reads as a partner', () => {
    const overrides: Partial<Args> = { correct: true, given: typed('re'), elapsedMs: 1000 };
    const result = grade(overrides);
    expect(result.confusedWith).toBeNull();
    expect(result.log.confusedWith).toBeNull();
    expect(result.priorityNew).toEqual([]);
    expect(result.states).toEqual([scheduled({ ...BASE, ...overrides }, RATING.easy)]);
  });
});

describe('gradeAnswer state lookup', () => {
  it('should schedule from the matching state when ね is not the first entry of states', () => {
    const overrides: Partial<Args> = { states: [WA_STATE, RE_STATE, NE_STATE] };
    const result = grade(overrides);
    const expected = schedule({ itemId: NE.id, state: NE_STATE, rating: RATING.easy, now: NOW, weakSeeds: [] });
    expect(result.states).toEqual([expected]);
    expect(result.states[0]?.reps).toBe(NE_STATE.reps + 1);
  });

  it('should schedule a first review from null when states hold only other items', () => {
    const overrides: Partial<Args> = { states: [RE_STATE, WA_STATE] };
    const result = grade(overrides);
    const expected = schedule({ itemId: NE.id, state: null, rating: RATING.easy, now: NOW, weakSeeds: [] });
    expect(result.states).toEqual([expected]);
    expect(result.states[0]?.reps).toBe(1);
  });

  it('should match schedule with weakSeeds, reps 2 and lapses 1, on the first review of a weak seed', () => {
    const overrides: Partial<Args> = { correct: true, given: typed('ne'), elapsedMs: 4000, states: [], weakSeeds: [NE.id] };
    const result = grade(overrides);
    const expected = schedule({ itemId: NE.id, state: null, rating: RATING.good, now: NOW, weakSeeds: [NE.id] });
    const unseeded = schedule({ itemId: NE.id, state: null, rating: RATING.good, now: NOW, weakSeeds: [] });
    expect(expected.reps).toBe(2);
    expect(expected.lapses).toBe(1);
    expect(result.states).toEqual([expected]);
    expect(result.states).not.toEqual([unseeded]);
    expect(result.states[0]?.reps).toBe(2);
    expect(result.states[0]?.lapses).toBe(1);
  });
});

describe('gradeAnswer log', () => {
  it('should pass logId, itemId, now, elapsedMs, and the rating through to the log', () => {
    const result = grade({ correct: true, given: typed('ne'), elapsedMs: 1234 });
    expect(result.log).toEqual({
      id: LOG_ID,
      itemId: NE.id,
      at: NOW,
      rating: RATING.easy,
      elapsedMs: 1234,
      confusedWith: null,
    });
    expect(result.log.at.getTime()).toBe(NOW.getTime());
  });

  it('should log the answered item id and elapsedMs on a wrong answer', () => {
    const result = grade({ correct: false, given: typed('re'), elapsedMs: 7777 });
    expect(result.log).toEqual({
      id: LOG_ID,
      itemId: NE.id,
      at: NOW,
      rating: RATING.again,
      elapsedMs: 7777,
      confusedWith: RE.id,
    });
  });
});

describe('gradeAnswer purity', () => {
  it('should return equal results when called twice with the same inputs', () => {
    const overrides: Partial<Args> = { correct: false, given: typed('re'), elapsedMs: 3000 };
    const first = grade(overrides);
    const second = grade(overrides);
    expect(first.confusedWith).toBe(RE.id);
    expect(first.states).toHaveLength(2);
    expect(first).toEqual(second);
  });

  it('should not mutate the input states array or its objects when a partner is moved', () => {
    const reState = reviewState(RE.id, new Date(FUTURE.getTime()), { stability: 0.75 });
    const neState = reviewState(NE.id, new Date(NOW.getTime()), { stability: 9.5, difficulty: 4.5, reps: 5, lapses: 0 });
    const states: ReadonlyArray<ReviewState> = [neState, reState, WA_STATE];
    const snapshot = states.map((state) => ({ ...state, due: new Date(state.due.getTime()) }));
    const result = grade({ correct: false, given: typed('re'), states });
    expect(result.states).toHaveLength(2);
    expect(states).toHaveLength(3);
    expect(states).toEqual(snapshot);
    expect(reState.due.getTime()).toBe(FUTURE.getTime());
    expect(neState.reps).toBe(5);
    expect(result.states[1]).not.toBe(reState);
  });
});
