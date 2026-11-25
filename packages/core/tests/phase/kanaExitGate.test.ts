import type { ContentItem, KanaItem, VocabItem } from '@wara/content/schema';
import { describe, expect, it } from 'vitest';
import type { Assessment, JlptSimAssessment, KanaExitAssessment, ReviewState } from '../../src/domain';
import { kanaExitGate } from '../../src/phase/kanaExitGate';

const kana = (char: string, romaji: string, group: KanaItem['data']['group'], script: 'hiragana' | 'katakana' = 'hiragana'): KanaItem => ({
  type: 'kana',
  id: `kana:${script === 'hiragana' ? 'hira' : 'kata'}:${char}`,
  level: 'kana',
  phase: 0,
  tags: [],
  data: { char, romaji, romajiAccepted: romaji === '' ? [] : [romaji], script, group },
});

const NE = kana('ね', 'ne', 'basic');
const RE = kana('れ', 're', 'basic');
const SO = kana('ソ', 'so', 'basic', 'katakana');
const N_KATA = kana('ン', 'n', 'basic', 'katakana');
const PI = kana('ぴ', 'pi', 'handakuten');
const SHA = kana('しゃ', 'sha', 'combination');
const SMALL_TSU = kana('っ', '', 'small');
const SMALL_TSU_KATA = kana('ッ', '', 'small', 'katakana');
const CHOONPU = kana('ー', '', 'mark', 'katakana');

const OLD_WI: KanaItem = { ...kana('ゐ', 'wi', 'basic'), supersededBy: 'kana:hira:い' };

const NEKO: VocabItem = {
  type: 'vocab',
  source: 'content',
  id: 'vocab:n5:ねこ',
  level: 'n5',
  phase: 0,
  tags: [],
  data: { word: 'ねこ', reading: 'ねこ', meaningId: 'vocab:n5:ねこ', pos: 'noun', register: 'plain', examples: [] },
};

const DRILLABLE: ReadonlyArray<KanaItem> = [NE, RE, SO, N_KATA, PI, SHA];

const ITEMS: ReadonlyArray<ContentItem> = [
  NE,
  SMALL_TSU,
  RE,
  SO,
  SMALL_TSU_KATA,
  N_KATA,
  PI,
  CHOONPU,
  SHA,
  OLD_WI,
  NEKO,
];

const reviewState = (itemId: string): ReviewState => ({
  itemId,
  stability: 2.5,
  difficulty: 5.1,
  due: new Date('2026-11-13T08:00:00Z'),
  lastReview: new Date('2026-11-12T08:00:00Z'),
  reps: 1,
  lapses: 0,
  learningSteps: 0,
  state: 'review',
});

const kanaExit = (id: string, date: string, passed: boolean): KanaExitAssessment => ({
  id,
  date,
  kind: 'kana-exit',
  passed,
  correct: passed ? 50 : 41,
  total: 50,
  elapsedMs: 240_000,
  wrong: passed ? [] : ['kana:kata:ン', 'kana:kata:ソ'],
});

const jlptSim = (id: string, date: string): JlptSimAssessment => ({
  id,
  date,
  kind: 'jlpt-sim',
  level: 'n5',
  score: 112,
});

const drillableStates: ReadonlyArray<ReviewState> = DRILLABLE.map((item) => reviewState(item.id));

const statesWithout = (missingId: string): ReadonlyArray<ReviewState> =>
  drillableStates.filter((state) => state.itemId !== missingId);

describe('kanaExitGate — open', () => {
  it('should be open when every drillable kana has a state while っ, ッ, ー and a superseded ゐ have none', () => {
    expect(kanaExitGate({ items: ITEMS, states: drillableStates, assessments: [] })).toBe('open');
  });

  it('should be open when states for vocab and unknown ids sit alongside every drillable kana state', () => {
    expect(
      kanaExitGate({
        items: ITEMS,
        states: [reviewState(NEKO.id), ...drillableStates, reviewState('kanji:n5:日')],
        assessments: [],
      }),
    ).toBe('open');
  });

  it('should be open rather than passed when only a failed kana-exit and a jlpt-sim exist and every drillable kana is reviewed', () => {
    expect(
      kanaExitGate({
        items: ITEMS,
        states: drillableStates,
        assessments: [kanaExit('assessment-1', '2026-11-10', false), jlptSim('assessment-2', '2026-11-11')],
      }),
    ).toBe('open');
  });

  it('should be open when the only assessment is a jlpt-sim and every drillable kana is reviewed', () => {
    expect(
      kanaExitGate({ items: ITEMS, states: drillableStates, assessments: [jlptSim('assessment-1', '2026-11-11')] }),
    ).toBe('open');
  });
});

describe('kanaExitGate — locked', () => {
  it('should be locked when ソ lacks a state, and open for the same fixture once ソ has one', () => {
    expect(kanaExitGate({ items: ITEMS, states: statesWithout(SO.id), assessments: [] })).toBe('locked');
    expect(
      kanaExitGate({ items: ITEMS, states: [...statesWithout(SO.id), reviewState(SO.id)], assessments: [] }),
    ).toBe('open');
  });

  it('should be locked when しゃ lacks a state and only a failed kana-exit exists, and open once しゃ has one', () => {
    const assessments: ReadonlyArray<Assessment> = [kanaExit('assessment-1', '2026-11-10', false)];
    expect(kanaExitGate({ items: ITEMS, states: statesWithout(SHA.id), assessments })).toBe('locked');
    expect(kanaExitGate({ items: ITEMS, states: [...statesWithout(SHA.id), reviewState(SHA.id)], assessments })).toBe(
      'open',
    );
  });

  it('should be locked when a vocab state stands in place of a missing kana state, and open once the kana state is added', () => {
    const withVocab = [...statesWithout(PI.id), reviewState(NEKO.id)];
    expect(kanaExitGate({ items: ITEMS, states: withVocab, assessments: [] })).toBe('locked');
    expect(kanaExitGate({ items: ITEMS, states: [...withVocab, reviewState(PI.id)], assessments: [] })).toBe('open');
  });

  it('should be locked when the only kana are っ and ー beside vocab, even with states for everything, while adding ね makes it open', () => {
    const items: ReadonlyArray<ContentItem> = [SMALL_TSU, CHOONPU, NEKO];
    const states = items.map((item) => reviewState(item.id));
    expect(kanaExitGate({ items, states, assessments: [] })).toBe('locked');
    expect(kanaExitGate({ items: [...items, NE], states: [...states, reviewState(NE.id)], assessments: [] })).toBe(
      'open',
    );
  });

  it('should be locked when there are no items at all, while a passed kana-exit still makes it passed', () => {
    expect(kanaExitGate({ items: [], states: [], assessments: [] })).toBe('locked');
    expect(kanaExitGate({ items: [], states: [], assessments: [kanaExit('assessment-1', '2026-11-10', true)] })).toBe(
      'passed',
    );
  });
});

describe('kanaExitGate — passed', () => {
  it('should be passed when a passed kana-exit exists and there are no states at all', () => {
    expect(
      kanaExitGate({ items: ITEMS, states: [], assessments: [kanaExit('assessment-1', '2026-11-10', true)] }),
    ).toBe('passed');
  });

  it('should be passed when a passed kana-exit exists and every drillable kana is reviewed', () => {
    expect(
      kanaExitGate({
        items: ITEMS,
        states: drillableStates,
        assessments: [kanaExit('assessment-1', '2026-11-10', true)],
      }),
    ).toBe('passed');
  });

  it('should be passed when a failed kana-exit is followed by a passed one', () => {
    expect(
      kanaExitGate({
        items: ITEMS,
        states: drillableStates,
        assessments: [kanaExit('assessment-1', '2026-11-10', false), kanaExit('assessment-2', '2026-11-12', true)],
      }),
    ).toBe('passed');
  });

  it('should be passed when a passed kana-exit is listed before a later failed one and a jlpt-sim', () => {
    expect(
      kanaExitGate({
        items: ITEMS,
        states: statesWithout(NE.id),
        assessments: [
          kanaExit('assessment-1', '2026-11-10', true),
          kanaExit('assessment-2', '2026-11-12', false),
          jlptSim('assessment-3', '2026-11-13'),
        ],
      }),
    ).toBe('passed');
  });
});

describe('kanaExitGate — purity', () => {
  it('should leave items, states, and assessments unchanged and return open twice', () => {
    const items = [...ITEMS];
    const states = [...drillableStates];
    const assessments: ReadonlyArray<Assessment> = [kanaExit('assessment-1', '2026-11-10', false)];
    const snapshot = JSON.stringify({ items, states, assessments });

    const first = kanaExitGate({ items, states, assessments });
    const second = kanaExitGate({ items, states, assessments });

    expect(first).toBe('open');
    expect(second).toBe(first);
    expect(JSON.stringify({ items, states, assessments })).toBe(snapshot);
    expect(items).toEqual(ITEMS);
  });
});
