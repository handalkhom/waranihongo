import { describe, expect, it } from 'vitest';
import { kanaExitAssessment } from '../../src/phase/kanaExitAssessment';
import { KANA_EXIT_TIME_LIMIT_MS, KANA_EXIT_WORD_COUNT } from '../../src/session/defaults';

const wordId = (i: number): string => `vocab:other:w${String(i)}`;

const answers = (
  count: number,
  wrongAt: ReadonlyArray<number> = [],
): ReadonlyArray<{ itemId: string; correct: boolean }> =>
  Array.from({ length: count }, (_, i) => ({ itemId: wordId(i), correct: !wrongAt.includes(i) }));

describe('kanaExitAssessment passing run', () => {
  it('should return the full passed assessment when 50 answers are correct in 95000 ms', () => {
    expect(
      kanaExitAssessment({
        answers: answers(KANA_EXIT_WORD_COUNT),
        elapsedMs: 95_000,
        id: 'a1',
        date: '2026-11-24',
      }),
    ).toEqual({
      id: 'a1',
      date: '2026-11-24',
      kind: 'kana-exit',
      passed: true,
      correct: 50,
      total: 50,
      elapsedMs: 95_000,
      wrong: [],
    });
  });
});

describe('kanaExitAssessment time limit', () => {
  it('should pass when 50 answers are correct at exactly the time limit', () => {
    expect(
      kanaExitAssessment({
        answers: answers(KANA_EXIT_WORD_COUNT),
        elapsedMs: KANA_EXIT_TIME_LIMIT_MS,
        id: 'a2',
        date: '2026-11-24',
      }),
    ).toEqual({
      id: 'a2',
      date: '2026-11-24',
      kind: 'kana-exit',
      passed: true,
      correct: 50,
      total: 50,
      elapsedMs: 120_000,
      wrong: [],
    });
  });

  it('should fail with 50 correct and no wrong ids when elapsed is one millisecond over the limit', () => {
    expect(
      kanaExitAssessment({
        answers: answers(KANA_EXIT_WORD_COUNT),
        elapsedMs: KANA_EXIT_TIME_LIMIT_MS + 1,
        id: 'a3',
        date: '2026-11-24',
      }),
    ).toEqual({
      id: 'a3',
      date: '2026-11-24',
      kind: 'kana-exit',
      passed: false,
      correct: 50,
      total: 50,
      elapsedMs: 120_001,
      wrong: [],
    });
  });
});

describe('kanaExitAssessment wrong answers', () => {
  it('should fail and count 48 correct with the two wrong ids in answer order when positions 3 and 40 are wrong', () => {
    expect(
      kanaExitAssessment({
        answers: answers(KANA_EXIT_WORD_COUNT, [40, 3]),
        elapsedMs: 60_000,
        id: 'a4',
        date: '2026-11-24',
      }),
    ).toEqual({
      id: 'a4',
      date: '2026-11-24',
      kind: 'kana-exit',
      passed: false,
      correct: 48,
      total: 50,
      elapsedMs: 60_000,
      wrong: [wordId(3), wordId(40)],
    });
  });

  it('should list wrong ids in answer order, not sorted by id', () => {
    const result = kanaExitAssessment({
      answers: [
        { itemId: 'vocab:other:みず', correct: false },
        ...answers(KANA_EXIT_WORD_COUNT - 3),
        { itemId: 'vocab:other:たべる', correct: false },
        { itemId: 'vocab:other:しんぱい', correct: false },
      ],
      elapsedMs: 1_000,
      id: 'a5',
      date: '2026-11-24',
    });
    expect({ correct: result.correct, total: result.total, wrong: result.wrong }).toEqual({
      correct: 47,
      total: 50,
      wrong: ['vocab:other:みず', 'vocab:other:たべる', 'vocab:other:しんぱい'],
    });
  });
});

describe('kanaExitAssessment word count', () => {
  it('should fail and count 30 of 30 when a shorter run is all correct within the limit', () => {
    expect(
      kanaExitAssessment({
        answers: answers(30),
        elapsedMs: 10_000,
        id: 'a6',
        date: '2026-11-24',
      }),
    ).toEqual({
      id: 'a6',
      date: '2026-11-24',
      kind: 'kana-exit',
      passed: false,
      correct: 30,
      total: 30,
      elapsedMs: 10_000,
      wrong: [],
    });
  });

  it('should fail when 51 answers are all correct within the limit', () => {
    const result = kanaExitAssessment({
      answers: answers(KANA_EXIT_WORD_COUNT + 1),
      elapsedMs: 0,
      id: 'a7',
      date: '2026-11-24',
    });
    expect({ passed: result.passed, correct: result.correct, total: result.total }).toEqual({
      passed: false,
      correct: 51,
      total: 51,
    });
  });

  it('should fail with zero counts and no wrong ids when there are no answers', () => {
    expect(
      kanaExitAssessment({ answers: [], elapsedMs: 5_000, id: 'a8', date: '2026-11-24' }),
    ).toEqual({
      id: 'a8',
      date: '2026-11-24',
      kind: 'kana-exit',
      passed: false,
      correct: 0,
      total: 0,
      elapsedMs: 5_000,
      wrong: [],
    });
  });
});

describe('kanaExitAssessment pass-through', () => {
  it('should copy id, date, and elapsedMs unchanged from the input', () => {
    const result = kanaExitAssessment({
      answers: answers(KANA_EXIT_WORD_COUNT, [7]),
      elapsedMs: 117_349,
      id: 'assessment-7f3c9e21',
      date: '2027-02-28',
    });
    expect({ id: result.id, date: result.date, elapsedMs: result.elapsedMs }).toEqual({
      id: 'assessment-7f3c9e21',
      date: '2027-02-28',
      elapsedMs: 117_349,
    });
  });
});

describe('kanaExitAssessment purity', () => {
  it('should leave the answers array unchanged and return equal results for the same inputs twice', () => {
    const given = answers(KANA_EXIT_WORD_COUNT, [2, 9, 40]);
    const snapshot = given.map((answer) => ({ ...answer }));
    const input = { answers: given, elapsedMs: 80_000, id: 'a9', date: '2026-11-24' };
    const first = kanaExitAssessment(input);
    expect(first.wrong).toEqual([wordId(2), wordId(9), wordId(40)]);
    expect(kanaExitAssessment(input)).toEqual(first);
    expect(given).toEqual(snapshot);
    expect(given.length).toBe(KANA_EXIT_WORD_COUNT);
  });
});
