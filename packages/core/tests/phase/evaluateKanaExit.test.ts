import { describe, expect, it } from 'vitest';
import { evaluateKanaExit } from '../../src/phase/evaluateKanaExit';
import { KANA_EXIT_TIME_LIMIT_MS, KANA_EXIT_WORD_COUNT } from '../../src/session/defaults';

const wordId = (i: number): string => `vocab:other:w${String(i)}`;

const answers = (
  count: number,
  wrongAt: ReadonlyArray<number> = [],
): ReadonlyArray<{ itemId: string; correct: boolean }> =>
  Array.from({ length: count }, (_, i) => ({ itemId: wordId(i), correct: !wrongAt.includes(i) }));

describe('evaluateKanaExit defaults', () => {
  it('should require 50 words within 120000 ms', () => {
    expect({ KANA_EXIT_WORD_COUNT, KANA_EXIT_TIME_LIMIT_MS }).toEqual({
      KANA_EXIT_WORD_COUNT: 50,
      KANA_EXIT_TIME_LIMIT_MS: 120_000,
    });
  });
});

describe('evaluateKanaExit time limit', () => {
  it('should pass when every word is correct at exactly the time limit', () => {
    expect(evaluateKanaExit(answers(KANA_EXIT_WORD_COUNT), KANA_EXIT_TIME_LIMIT_MS)).toEqual({
      passed: true,
      wrong: [],
    });
  });

  it('should pass when every word is correct at 0 ms', () => {
    expect(evaluateKanaExit(answers(KANA_EXIT_WORD_COUNT), 0)).toEqual({ passed: true, wrong: [] });
  });

  it('should pass when every word is correct one millisecond under the time limit', () => {
    expect(evaluateKanaExit(answers(KANA_EXIT_WORD_COUNT), KANA_EXIT_TIME_LIMIT_MS - 1)).toEqual({
      passed: true,
      wrong: [],
    });
  });

  it('should fail with no wrong ids when every word is correct one millisecond over the time limit', () => {
    expect(evaluateKanaExit(answers(KANA_EXIT_WORD_COUNT), KANA_EXIT_TIME_LIMIT_MS + 1)).toEqual({
      passed: false,
      wrong: [],
    });
  });

  it('should fail and list every id when every word is wrong and time is over the limit', () => {
    const allWrong = Array.from({ length: KANA_EXIT_WORD_COUNT }, (_, i) => i);
    expect(
      evaluateKanaExit(answers(KANA_EXIT_WORD_COUNT, allWrong), KANA_EXIT_TIME_LIMIT_MS + 1),
    ).toEqual({ passed: false, wrong: allWrong.map(wordId) });
  });
});

describe('evaluateKanaExit correctness', () => {
  it('should fail and list the one wrong id when 49 of 50 are correct within the limit', () => {
    expect(evaluateKanaExit(answers(KANA_EXIT_WORD_COUNT, [17]), KANA_EXIT_TIME_LIMIT_MS)).toEqual({
      passed: false,
      wrong: [wordId(17)],
    });
  });

  it('should fail when only the first word is wrong', () => {
    expect(evaluateKanaExit(answers(KANA_EXIT_WORD_COUNT, [0]), 0)).toEqual({
      passed: false,
      wrong: [wordId(0)],
    });
  });

  it('should fail when only the last word is wrong', () => {
    expect(
      evaluateKanaExit(answers(KANA_EXIT_WORD_COUNT, [KANA_EXIT_WORD_COUNT - 1]), 0),
    ).toEqual({ passed: false, wrong: [wordId(KANA_EXIT_WORD_COUNT - 1)] });
  });

  it('should list several wrong ids in answer order, not sorted by id', () => {
    expect(
      evaluateKanaExit(
        [
          { itemId: 'vocab:other:みず', correct: false },
          ...answers(KANA_EXIT_WORD_COUNT - 4),
          { itemId: 'vocab:other:たべる', correct: false },
          { itemId: 'vocab:other:おおきい', correct: true },
          { itemId: 'vocab:other:しんぱい', correct: false },
        ],
        KANA_EXIT_TIME_LIMIT_MS,
      ),
    ).toEqual({
      passed: false,
      wrong: ['vocab:other:みず', 'vocab:other:たべる', 'vocab:other:しんぱい'],
    });
  });
});

describe('evaluateKanaExit word count', () => {
  it('should fail when 49 answers are all correct within the limit', () => {
    expect(evaluateKanaExit(answers(KANA_EXIT_WORD_COUNT - 1), 0)).toEqual({
      passed: false,
      wrong: [],
    });
  });

  it('should fail when 51 answers are all correct within the limit', () => {
    expect(evaluateKanaExit(answers(KANA_EXIT_WORD_COUNT + 1), 0)).toEqual({
      passed: false,
      wrong: [],
    });
  });

  it('should still list wrong ids when the answer count is not the required count', () => {
    expect(evaluateKanaExit(answers(KANA_EXIT_WORD_COUNT + 1, [3, 50]), 0)).toEqual({
      passed: false,
      wrong: [wordId(3), wordId(50)],
    });
  });

  it('should fail with no wrong ids when there are no answers', () => {
    expect(evaluateKanaExit([], 0)).toEqual({ passed: false, wrong: [] });
  });
});

describe('evaluateKanaExit determinism', () => {
  it('should return equal results for the same inputs twice', () => {
    const given = answers(KANA_EXIT_WORD_COUNT, [2, 9, 40]);
    const first = evaluateKanaExit(given, KANA_EXIT_TIME_LIMIT_MS);
    expect(first.wrong).toEqual([wordId(2), wordId(9), wordId(40)]);
    expect(evaluateKanaExit(given, KANA_EXIT_TIME_LIMIT_MS)).toEqual(first);
  });
});
