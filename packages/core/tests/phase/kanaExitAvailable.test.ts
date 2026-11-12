import { describe, expect, it } from 'vitest';
import type { JlptSimAssessment, KanaExitAssessment, ReviewState } from '../../src/domain';
import { kanaExitAvailable } from '../../src/phase/kanaExitAvailable';

const KANA_IDS = ['kana:hira:ね', 'kana:hira:れ', 'kana:kata:ン', 'kana:kata:ソ'] as const;

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

const allKanaStates: ReadonlyArray<ReviewState> = KANA_IDS.map(reviewState);

describe('kanaExitAvailable', () => {
  it('should be false when one kana has no review state', () => {
    expect(
      kanaExitAvailable({
        kanaIds: KANA_IDS,
        states: KANA_IDS.slice(0, 3).map(reviewState),
        assessments: [],
      }),
    ).toBe(false);
  });

  it('should be true when every kana has a review state and no assessment exists', () => {
    expect(kanaExitAvailable({ kanaIds: KANA_IDS, states: allKanaStates, assessments: [] })).toBe(
      true,
    );
  });

  it('should be true when every kana is reviewed and the only kana-exit failed', () => {
    expect(
      kanaExitAvailable({
        kanaIds: KANA_IDS,
        states: allKanaStates,
        assessments: [kanaExit('assessment-1', '2026-11-10', false)],
      }),
    ).toBe(true);
  });

  it('should be false when every kana is reviewed and a kana-exit passed', () => {
    expect(
      kanaExitAvailable({
        kanaIds: KANA_IDS,
        states: allKanaStates,
        assessments: [kanaExit('assessment-1', '2026-11-10', true)],
      }),
    ).toBe(false);
  });

  it('should be false when a failed kana-exit is followed by a passed one', () => {
    expect(
      kanaExitAvailable({
        kanaIds: KANA_IDS,
        states: allKanaStates,
        assessments: [
          kanaExit('assessment-1', '2026-11-10', false),
          kanaExit('assessment-2', '2026-11-12', true),
        ],
      }),
    ).toBe(false);
  });

  it('should be false when a passed kana-exit is listed before a later failed one', () => {
    expect(
      kanaExitAvailable({
        kanaIds: KANA_IDS,
        states: allKanaStates,
        assessments: [
          kanaExit('assessment-1', '2026-11-10', true),
          kanaExit('assessment-2', '2026-11-12', false),
        ],
      }),
    ).toBe(false);
  });

  it('should be true when every kana is reviewed and the only assessment is a jlpt-sim', () => {
    expect(
      kanaExitAvailable({
        kanaIds: KANA_IDS,
        states: allKanaStates,
        assessments: [jlptSim('assessment-1', '2026-11-11')],
      }),
    ).toBe(true);
  });

  it('should be true when states for non-kana ids sit alongside states for every kana', () => {
    expect(
      kanaExitAvailable({
        kanaIds: KANA_IDS,
        states: [reviewState('vocab:other:ねこ'), ...allKanaStates, reviewState('kanji:n5:日')],
        assessments: [],
      }),
    ).toBe(true);
  });

  it('should be false when a state for a different id stands in place of a missing kana', () => {
    expect(
      kanaExitAvailable({
        kanaIds: KANA_IDS,
        states: [...KANA_IDS.slice(0, 3).map(reviewState), reviewState('vocab:other:ねこ')],
        assessments: [],
      }),
    ).toBe(false);
  });

  it('should be true when states arrive in a different order from kanaIds', () => {
    expect(
      kanaExitAvailable({
        kanaIds: KANA_IDS,
        states: [...allKanaStates].reverse(),
        assessments: [],
      }),
    ).toBe(true);
  });

  it('should be false when kanaIds is empty even with states and no assessment', () => {
    expect(kanaExitAvailable({ kanaIds: [], states: allKanaStates, assessments: [] })).toBe(false);
  });

  it('should be false when kanaIds is empty and there are no states', () => {
    expect(kanaExitAvailable({ kanaIds: [], states: [], assessments: [] })).toBe(false);
  });

  it('should return the same true result for the same input given twice', () => {
    const input = {
      kanaIds: KANA_IDS,
      states: allKanaStates,
      assessments: [kanaExit('assessment-1', '2026-11-10', false), jlptSim('assessment-2', '2026-11-11')],
    };
    const first = kanaExitAvailable(input);
    expect(first).toBe(true);
    expect(kanaExitAvailable(input)).toBe(first);
  });
});
