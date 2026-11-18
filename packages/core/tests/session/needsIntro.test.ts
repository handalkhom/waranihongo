import type { ContentItem, CustomVocabItem, KanaItem, VocabItem } from '@wara/content/schema';
import { describe, expect, it } from 'vitest';
import type { CardState, ReviewState, SessionActivityKind } from '../../src/domain';
import { needsIntro } from '../../src/session/needsIntro';

const NOW = new Date('2026-11-16T09:00:00Z');

const CARD_STATES: ReadonlyArray<CardState> = ['new', 'learning', 'review', 'relearning'];

const NE: KanaItem = {
  type: 'kana',
  id: 'kana:hira:ね',
  level: 'kana',
  phase: 0,
  tags: [],
  data: {
    char: 'ね',
    romaji: 'ne',
    romajiAccepted: ['ne'],
    script: 'hiragana',
    group: 'basic',
    mnemonic: 'Seekor kucing (neko) melingkar dengan ekornya.',
  },
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
  reps: state === 'new' ? 0 : 1,
  lapses: state === 'relearning' ? 1 : 0,
  learningSteps: 0,
  state,
});

const intro = (item: ContentItem, state: ReviewState | null, activity: SessionActivityKind): boolean =>
  needsIntro({ item, state, activity });

describe('needsIntro — a kana met for the first time', () => {
  it('should return true when a kana with a mnemonic has no state in a new activity', () => {
    expect(intro(NE, null, 'new')).toBe(true);
  });

  it('should return true when a kana without a mnemonic has no state in a new activity', () => {
    expect(SO.data.mnemonic).toBeUndefined();
    expect(intro(SO, null, 'new')).toBe(true);
  });
});

describe('needsIntro — a kana already reviewed', () => {
  it('should return false for a kana with a state of any FSRS value in a new activity, though the same kana without a state is true', () => {
    expect(intro(NE, null, 'new')).toBe(true);
    for (const cardState of CARD_STATES) {
      expect(intro(NE, stateOf(NE.id, cardState), 'new')).toBe(false);
      expect(intro(SO, stateOf(SO.id, cardState), 'new')).toBe(false);
    }
  });

  it('should return false for a wrong answer requeued after its first review, though before that review it was true', () => {
    expect(intro(SO, null, 'new')).toBe(true);
    expect(intro(SO, stateOf(SO.id, 'learning'), 'new')).toBe(false);
  });
});

describe('needsIntro — activities other than new', () => {
  it('should return false for a kana with no state in a review or production activity, though the same kana in new is true', () => {
    expect(intro(NE, null, 'new')).toBe(true);
    expect(intro(NE, null, 'review')).toBe(false);
    expect(intro(NE, null, 'production')).toBe(false);
    expect(intro(SO, null, 'review')).toBe(false);
    expect(intro(SO, null, 'production')).toBe(false);
  });
});

describe('needsIntro — vocabulary', () => {
  it('should return false for a content vocab item with no state in a new activity, though a kana in the same position is true', () => {
    expect(intro(NE, null, 'new')).toBe(true);
    expect(intro(NEKO, null, 'new')).toBe(false);
  });

  it('should return false for a custom vocab item with no state in a new activity, though a kana in the same position is true', () => {
    expect(intro(SO, null, 'new')).toBe(true);
    expect(intro(CUSTOM, null, 'new')).toBe(false);
  });

  it('should return false for vocab in every activity with or without a state, though a kana with no state in new is true', () => {
    expect(intro(NE, null, 'new')).toBe(true);
    for (const activity of ['review', 'new', 'production'] as const) {
      for (const item of [NEKO, CUSTOM]) {
        expect(intro(item, null, activity)).toBe(false);
        expect(intro(item, stateOf(item.id, 'review'), activity)).toBe(false);
      }
    }
  });
});

describe('needsIntro — the full truth table', () => {
  it('should return true for exactly one combination per item: a kana, no state, a new activity', () => {
    const items: ReadonlyArray<ContentItem> = [NE, SO, NEKO, CUSTOM];
    const activities: ReadonlyArray<SessionActivityKind> = ['review', 'new', 'production'];
    const trueCases = items.flatMap((item) =>
      activities.flatMap((activity) =>
        [null, ...CARD_STATES.map((cardState) => stateOf(item.id, cardState))]
          .filter((state) => intro(item, state, activity))
          .map((state) => `${item.id}|${activity}|${state === null ? 'null' : state.state}`),
      ),
    );
    expect(trueCases).toEqual(['kana:hira:ね|new|null', 'kana:kata:ソ|new|null']);
  });
});

describe('needsIntro — purity', () => {
  it('should leave frozen inputs unchanged and return the same answer twice', () => {
    const item: KanaItem = Object.freeze({
      ...NE,
      tags: Object.freeze([]),
      data: Object.freeze({ ...NE.data, romajiAccepted: Object.freeze(['ne']) }),
    });
    const state = Object.freeze(stateOf(SO.id, 'learning'));
    const snapshot = JSON.stringify({ item, state });

    const first = intro(item, null, 'new');
    const second = intro(item, null, 'new');
    const withState = intro(SO, state, 'new');

    expect(JSON.stringify({ item, state })).toBe(snapshot);
    expect(item).toEqual(NE);
    expect(first).toBe(true);
    expect(second).toBe(first);
    expect(withState).toBe(false);
  });
});
