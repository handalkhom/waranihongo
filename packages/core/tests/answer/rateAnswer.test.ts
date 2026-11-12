import { describe, expect, it } from 'vitest';
import { rateAnswer } from '../../src/answer/rateAnswer';
import { RATING } from '../../src/domain';
import {
  RATE_CHOICE_GOOD_MAX_MS,
  RATE_TYPED_EASY_MAX_MS,
  RATE_TYPED_GOOD_MAX_MS,
} from '../../src/session/defaults';

describe('rateAnswer defaults', () => {
  it('should keep the typed easy, typed good, and choice good thresholds at 2500, 6000, and 4000 ms', () => {
    expect({
      typedEasy: RATE_TYPED_EASY_MAX_MS,
      typedGood: RATE_TYPED_GOOD_MAX_MS,
      choiceGood: RATE_CHOICE_GOOD_MAX_MS,
    }).toEqual({ typedEasy: 2500, typedGood: 6000, choiceGood: 4000 });
  });
});

describe('rateAnswer with a wrong answer', () => {
  it('should rate again when a typed answer is wrong at 0 ms', () => {
    expect(rateAnswer({ correct: false, elapsedMs: 0, mode: 'typed' })).toBe(RATING.again);
  });

  it('should rate again when a choice answer is wrong at 0 ms', () => {
    expect(rateAnswer({ correct: false, elapsedMs: 0, mode: 'choice' })).toBe(RATING.again);
  });

  it('should rate again when a typed answer is wrong exactly at the easy threshold', () => {
    expect(
      rateAnswer({ correct: false, elapsedMs: RATE_TYPED_EASY_MAX_MS, mode: 'typed' }),
    ).toBe(RATING.again);
  });

  it('should rate again when a typed answer is wrong long after the good threshold', () => {
    expect(
      rateAnswer({ correct: false, elapsedMs: RATE_TYPED_GOOD_MAX_MS * 10, mode: 'typed' }),
    ).toBe(RATING.again);
  });

  it('should rate again when a choice answer is wrong long after the good threshold', () => {
    expect(
      rateAnswer({ correct: false, elapsedMs: RATE_CHOICE_GOOD_MAX_MS * 10, mode: 'choice' }),
    ).toBe(RATING.again);
  });
});

describe('rateAnswer with a correct typed answer', () => {
  it('should rate easy when a typed answer is correct at 0 ms', () => {
    expect(rateAnswer({ correct: true, elapsedMs: 0, mode: 'typed' })).toBe(RATING.easy);
  });

  it('should rate easy when a typed answer is correct exactly at the easy threshold', () => {
    expect(
      rateAnswer({ correct: true, elapsedMs: RATE_TYPED_EASY_MAX_MS, mode: 'typed' }),
    ).toBe(RATING.easy);
  });

  it('should rate good when a typed answer is correct one ms after the easy threshold', () => {
    expect(
      rateAnswer({ correct: true, elapsedMs: RATE_TYPED_EASY_MAX_MS + 1, mode: 'typed' }),
    ).toBe(RATING.good);
  });

  it('should rate good when a typed answer is correct exactly at the good threshold', () => {
    expect(
      rateAnswer({ correct: true, elapsedMs: RATE_TYPED_GOOD_MAX_MS, mode: 'typed' }),
    ).toBe(RATING.good);
  });

  it('should rate hard when a typed answer is correct one ms after the good threshold', () => {
    expect(
      rateAnswer({ correct: true, elapsedMs: RATE_TYPED_GOOD_MAX_MS + 1, mode: 'typed' }),
    ).toBe(RATING.hard);
  });
});

describe('rateAnswer with a correct choice answer', () => {
  it('should rate good, never easy, when a choice answer is correct at 0 ms', () => {
    expect(rateAnswer({ correct: true, elapsedMs: 0, mode: 'choice' })).toBe(RATING.good);
  });

  it('should rate good, never easy, when a choice answer is correct exactly at the typed easy threshold', () => {
    expect(
      rateAnswer({ correct: true, elapsedMs: RATE_TYPED_EASY_MAX_MS, mode: 'choice' }),
    ).toBe(RATING.good);
  });

  it('should rate good when a choice answer is correct exactly at the choice good threshold', () => {
    expect(
      rateAnswer({ correct: true, elapsedMs: RATE_CHOICE_GOOD_MAX_MS, mode: 'choice' }),
    ).toBe(RATING.good);
  });

  it('should rate hard when a choice answer is correct one ms after the choice good threshold', () => {
    expect(
      rateAnswer({ correct: true, elapsedMs: RATE_CHOICE_GOOD_MAX_MS + 1, mode: 'choice' }),
    ).toBe(RATING.hard);
  });

  it('should rate a correct choice answer hard where a correct typed answer at the same time is still good', () => {
    const elapsedMs = RATE_CHOICE_GOOD_MAX_MS + 1;
    expect([
      rateAnswer({ correct: true, elapsedMs, mode: 'choice' }),
      rateAnswer({ correct: true, elapsedMs, mode: 'typed' }),
    ]).toEqual([RATING.hard, RATING.good]);
  });
});

describe('rateAnswer determinism', () => {
  it('should return the same rating for the same input given twice', () => {
    const inputs: ReadonlyArray<Parameters<typeof rateAnswer>[0]> = [
      { correct: true, elapsedMs: 0, mode: 'typed' },
      { correct: true, elapsedMs: RATE_TYPED_EASY_MAX_MS + 1, mode: 'typed' },
      { correct: true, elapsedMs: RATE_CHOICE_GOOD_MAX_MS, mode: 'choice' },
      { correct: false, elapsedMs: 0, mode: 'choice' },
    ];
    const first = inputs.map((input) => rateAnswer(input));
    const second = inputs.map((input) => rateAnswer(input));
    expect(second).toEqual(first);
    expect(first).toEqual([RATING.easy, RATING.good, RATING.good, RATING.again]);
  });
});
