import { describe, expect, it } from 'vitest';
import type { JlptLevel, JlptSimAssessment, KanaExitAssessment } from '../../src/domain';
import { derivePhase } from '../../src/phase/derivePhase';
import { JLPT_SIM_PASS_SCORE } from '../../src/session/defaults';

const kanaExit = (id: string, date: string, passed: boolean): KanaExitAssessment => ({
  id,
  date,
  kind: 'kana-exit',
  passed,
  correct: passed ? 50 : 44,
  total: 50,
  elapsedMs: passed ? 110_000 : 150_000,
  wrong: passed ? [] : ['kana:kata:ン', 'kana:kata:ソ'],
});

const jlptSim = (id: string, date: string, level: JlptLevel, score: number): JlptSimAssessment => ({
  id,
  date,
  kind: 'jlpt-sim',
  level,
  score,
});

const passedKana = kanaExit('a-kana-pass', '2026-11-12', true);
const failedKana = kanaExit('a-kana-fail', '2026-11-05', false);
const n5Pass = jlptSim('a-n5-pass', '2027-03-01', 'n5', JLPT_SIM_PASS_SCORE.n5);
const n5Below = jlptSim('a-n5-below', '2027-02-01', 'n5', JLPT_SIM_PASS_SCORE.n5 - 0.01);
const n4Pass = jlptSim('a-n4-pass', '2027-09-01', 'n4', JLPT_SIM_PASS_SCORE.n4);
const n4Below = jlptSim('a-n4-below', '2027-08-01', 'n4', JLPT_SIM_PASS_SCORE.n4 - 0.01);

describe('JLPT_SIM_PASS_SCORE', () => {
  it('should pin the pass scores at 0.8 for n5 and 0.7 for n4', () => {
    expect(JLPT_SIM_PASS_SCORE).toEqual({ n5: 0.8, n4: 0.7 });
  });
});

describe('derivePhase', () => {
  describe('phase 0 and 1: kana-exit', () => {
    it('should return 0 when there are no assessments', () => {
      expect(derivePhase({ assessments: [] })).toBe(0);
    });

    it('should return 0 when the only kana-exit failed', () => {
      expect(derivePhase({ assessments: [failedKana] })).toBe(0);
    });

    it('should return 1 when a kana-exit passed', () => {
      expect(derivePhase({ assessments: [passedKana] })).toBe(1);
    });

    it('should return 1 when a failed kana-exit is followed by a passed one', () => {
      expect(derivePhase({ assessments: [failedKana, passedKana] })).toBe(1);
    });

    it('should return 1 when a passed kana-exit is followed by a failed one', () => {
      expect(derivePhase({ assessments: [passedKana, failedKana] })).toBe(1);
    });
  });

  describe('phase 2: best n5 jlpt-sim', () => {
    it('should return 2 when a kana-exit passed and the n5 score is exactly the pass score', () => {
      expect(derivePhase({ assessments: [passedKana, n5Pass] })).toBe(2);
    });

    it('should return 1 when a kana-exit passed and the n5 score is just below the pass score', () => {
      expect(derivePhase({ assessments: [passedKana, n5Below] })).toBe(1);
    });

    it('should return 0 when the n5 score passes but no kana-exit passed', () => {
      expect(derivePhase({ assessments: [n5Pass] })).toBe(0);
    });

    it('should return 0 when the n5 score passes and the only kana-exit failed', () => {
      expect(derivePhase({ assessments: [failedKana, n5Pass] })).toBe(0);
    });

    it('should return 2 when a low n5 score is followed by a passing n5 score', () => {
      expect(derivePhase({ assessments: [passedKana, n5Below, n5Pass] })).toBe(2);
    });

    it('should return 2 when a passing n5 score is followed by a lower n5 score', () => {
      expect(derivePhase({ assessments: [n5Pass, n5Below, passedKana] })).toBe(2);
    });

    it('should return 1 when a passing n4 score stands in for a missing n5 pass', () => {
      expect(derivePhase({ assessments: [passedKana, jlptSim('a-n4-high', '2027-03-01', 'n4', 0.95)] })).toBe(1);
    });

    it('should return 1 when the n4 score is high but the n5 score is just below the n5 pass score', () => {
      expect(
        derivePhase({
          assessments: [passedKana, n5Below, jlptSim('a-n4-high', '2027-03-01', 'n4', 0.95)],
        }),
      ).toBe(1);
    });
  });

  describe('phase 3: best n4 jlpt-sim', () => {
    it('should return 3 when kana-exit and n5 passed and the n4 score is exactly the pass score', () => {
      expect(derivePhase({ assessments: [passedKana, n5Pass, n4Pass] })).toBe(3);
    });

    it('should return 2 when kana-exit and n5 passed and the n4 score is just below the pass score', () => {
      expect(derivePhase({ assessments: [passedKana, n5Pass, n4Below] })).toBe(2);
    });

    it('should return 1 when the n4 score passes but no n5 score ever passed', () => {
      expect(derivePhase({ assessments: [passedKana, n5Below, n4Pass] })).toBe(1);
    });

    it('should return 0 when n5 and n4 pass but no kana-exit exists', () => {
      expect(derivePhase({ assessments: [n5Pass, n4Pass] })).toBe(0);
    });

    it('should return 0 when only an n4 pass exists', () => {
      expect(derivePhase({ assessments: [n4Pass] })).toBe(0);
    });

    it('should return 3 when a passing n4 score is listed before a lower n4 score', () => {
      expect(derivePhase({ assessments: [n4Pass, n4Below, n5Pass, passedKana] })).toBe(3);
    });

    it('should return 3 when a lower n4 score is listed before a passing one', () => {
      expect(derivePhase({ assessments: [passedKana, n5Pass, n4Below, n4Pass] })).toBe(3);
    });

    it('should return 2 when an n5 score at the n4 pass score is not counted as an n4 pass', () => {
      expect(
        derivePhase({
          assessments: [passedKana, n5Pass, jlptSim('a-n5-at-n4', '2027-09-01', 'n5', JLPT_SIM_PASS_SCORE.n4)],
        }),
      ).toBe(2);
    });
  });

  it('should return the same phase for the same assessments on repeated calls', () => {
    const assessments = [failedKana, passedKana, n5Below, n5Pass, n4Below];
    const first = derivePhase({ assessments });
    expect(first).toBe(2);
    expect(derivePhase({ assessments })).toBe(first);
  });
});
