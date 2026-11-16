import type { ContentItem, CustomVocabItem, KanaItem, VocabItem } from '@wara/content/schema';
import { describe, expect, it, vi } from 'vitest';
import type { CardState, ReviewState, SessionActivityKind } from '../../src/domain';
import { chooseDrill } from '../../src/session/chooseDrill';
import type { DrillChoice } from '../../src/session/chooseDrill';

const NOW = new Date('2026-11-16T09:00:00Z');

const ACTIVITIES: ReadonlyArray<SessionActivityKind> = ['review', 'new', 'production'];

const NE: KanaItem = {
  type: 'kana',
  id: 'kana:hira:ね',
  level: 'kana',
  phase: 0,
  tags: [],
  data: { char: 'ね', romaji: 'ne', romajiAccepted: ['ne'], script: 'hiragana', group: 'basic' },
};

const SO: KanaItem = {
  type: 'kana',
  id: 'kana:kata:ソ',
  level: 'kana',
  phase: 0,
  tags: [],
  data: { char: 'ソ', romaji: 'so', romajiAccepted: ['so'], script: 'katakana', group: 'basic' },
};

const NEKO: VocabItem = {
  type: 'vocab',
  source: 'content',
  id: 'vocab:n5:ねこ',
  level: 'n5',
  phase: 0,
  tags: [],
  data: { word: 'ねこ', reading: 'ねこ', meaningId: 'vocab:n5:ねこ', pos: 'noun', register: 'plain', examples: [] },
};

const CUSTOM: CustomVocabItem = {
  type: 'vocab',
  source: 'custom',
  id: 'vocab:custom:0f8e2a4c-1b3d-4e5f-8a9b-0c1d2e3f4a5b',
  level: 'custom',
  phase: 0,
  tags: [],
  data: { word: 'やばい', reading: 'やばい', meaning: 'gawat' },
};

const stateOf = (itemId: string, state: CardState): ReviewState => ({
  itemId,
  stability: state === 'new' ? 0 : 3.2,
  difficulty: 5,
  due: NOW,
  lastReview: state === 'new' ? null : new Date('2026-11-13T09:00:00Z'),
  reps: state === 'new' ? 0 : 4,
  lapses: state === 'relearning' ? 1 : 0,
  learningSteps: 0,
  state,
});

const choose = (
  item: ContentItem,
  state: ReviewState | null,
  activity: SessionActivityKind,
  rngValue = 0.3,
): { readonly choice: DrillChoice; readonly calls: number } => {
  const rng = vi.fn<() => number>().mockReturnValueOnce(rngValue).mockReturnValue(0.99);
  const choice = chooseDrill({ item, state, activity, rng });
  return { choice, calls: rng.mock.calls.length };
};

describe('chooseDrill — vocabulary', () => {
  it('should return word-reading for a content vocab item in every activity without calling rng', () => {
    for (const activity of ACTIVITIES) {
      expect(choose(NEKO, null, activity)).toEqual({ choice: { kind: 'word-reading' }, calls: 0 });
      expect(choose(NEKO, stateOf(NEKO.id, 'review'), activity)).toEqual({ choice: { kind: 'word-reading' }, calls: 0 });
    }
  });

  it('should return word-reading for a custom vocab item in every activity without calling rng', () => {
    for (const activity of ACTIVITIES) {
      expect(choose(CUSTOM, null, activity)).toEqual({ choice: { kind: 'word-reading' }, calls: 0 });
      expect(choose(CUSTOM, stateOf(CUSTOM.id, 'learning'), activity)).toEqual({
        choice: { kind: 'word-reading' },
        calls: 0,
      });
    }
  });
});

describe('chooseDrill — kana in review and new', () => {
  it('should return kana-to-romaji with choice when the kana has no state, without calling rng', () => {
    expect(choose(NE, null, 'new')).toEqual({ choice: { kind: 'kana-to-romaji', answerMode: 'choice' }, calls: 0 });
    expect(choose(NE, null, 'review')).toEqual({ choice: { kind: 'kana-to-romaji', answerMode: 'choice' }, calls: 0 });
  });

  it('should return kana-to-romaji with typed only when the card has graduated to the review state', () => {
    expect(choose(NE, stateOf(NE.id, 'review'), 'review')).toEqual({
      choice: { kind: 'kana-to-romaji', answerMode: 'typed' },
      calls: 0,
    });
    expect(choose(SO, stateOf(SO.id, 'review'), 'new')).toEqual({
      choice: { kind: 'kana-to-romaji', answerMode: 'typed' },
      calls: 0,
    });
  });

  it('should return kana-to-romaji with choice when the card state is new, learning, or relearning', () => {
    const notGraduated: ReadonlyArray<CardState> = ['new', 'learning', 'relearning'];
    for (const cardState of notGraduated) {
      for (const activity of ['review', 'new'] as const) {
        expect(choose(NE, stateOf(NE.id, cardState), activity)).toEqual({
          choice: { kind: 'kana-to-romaji', answerMode: 'choice' },
          calls: 0,
        });
      }
    }
  });

  it('should drop a forgotten card back to choice when its state goes from review to relearning', () => {
    expect(choose(NE, stateOf(NE.id, 'review'), 'review').choice).toEqual({ kind: 'kana-to-romaji', answerMode: 'typed' });
    expect(choose(NE, stateOf(NE.id, 'relearning'), 'review').choice).toEqual({
      kind: 'kana-to-romaji',
      answerMode: 'choice',
    });
  });
});

describe('chooseDrill — kana in production', () => {
  it('should call rng exactly once and pick dictation below 0.5 and romaji-to-kana from 0.5 upward', () => {
    const table: ReadonlyArray<readonly [number, DrillChoice]> = [
      [0, { kind: 'dictation' }],
      [0.2, { kind: 'dictation' }],
      [0.4999, { kind: 'dictation' }],
      [0.5, { kind: 'romaji-to-kana' }],
      [0.7, { kind: 'romaji-to-kana' }],
      [0.9999, { kind: 'romaji-to-kana' }],
    ];
    for (const [value, expected] of table) {
      expect(choose(NE, null, 'production', value)).toEqual({ choice: expected, calls: 1 });
    }
  });

  it('should never return kana-to-romaji in production, even for a graduated card', () => {
    expect(choose(SO, stateOf(SO.id, 'review'), 'production', 0.2)).toEqual({ choice: { kind: 'dictation' }, calls: 1 });
    expect(choose(SO, stateOf(SO.id, 'review'), 'production', 0.8)).toEqual({
      choice: { kind: 'romaji-to-kana' },
      calls: 1,
    });
    expect(choose(SO, stateOf(SO.id, 'learning'), 'production', 0.5)).toEqual({
      choice: { kind: 'romaji-to-kana' },
      calls: 1,
    });
  });
});

describe('chooseDrill — determinism', () => {
  it('should return equal choices for the same inputs and the same rng values', () => {
    const cases: ReadonlyArray<readonly [ContentItem, ReviewState | null, SessionActivityKind, number]> = [
      [NE, null, 'production', 0.2],
      [NE, null, 'production', 0.5],
      [SO, stateOf(SO.id, 'review'), 'review', 0.3],
      [SO, stateOf(SO.id, 'learning'), 'new', 0.3],
      [NEKO, null, 'production', 0.3],
    ];
    const expected: ReadonlyArray<DrillChoice> = [
      { kind: 'dictation' },
      { kind: 'romaji-to-kana' },
      { kind: 'kana-to-romaji', answerMode: 'typed' },
      { kind: 'kana-to-romaji', answerMode: 'choice' },
      { kind: 'word-reading' },
    ];
    const first = cases.map(([item, state, activity, value]) => choose(item, state, activity, value).choice);
    const second = cases.map(([item, state, activity, value]) => choose(item, state, activity, value).choice);
    expect(second).toEqual(first);
    expect(first).toEqual(expected);
  });
});
