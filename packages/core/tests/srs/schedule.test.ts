import { describe, expect, it } from 'vitest';
import { RATING } from '../../src/domain';
import type { Rating, ReviewState } from '../../src/domain';
import { schedule } from '../../src/srs/schedule';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const ITEM_ID = 'kana:hira:ね';
const OTHER_ID = 'kana:hira:れ';
const NOW = new Date('2026-11-13T09:00:00Z');

const at = (base: Date, offsetMs: number): Date => new Date(base.getTime() + offsetMs);

const matureState = (now: Date): ReviewState => ({
  itemId: ITEM_ID,
  stability: 10,
  difficulty: 5,
  due: new Date(now.getTime()),
  lastReview: at(now, -10 * DAY_MS),
  reps: 5,
  lapses: 0,
  learningSteps: 0,
  state: 'review',
});

const firstReview = (rating: Rating, weakSeeds: ReadonlyArray<string> = []): ReviewState =>
  schedule({ itemId: ITEM_ID, state: null, rating, now: NOW, weakSeeds });

describe('schedule', () => {
  describe('first review (state null)', () => {
    it('should start learning with due 10 minutes later, reps 1 and lapses 0 when rated Good', () => {
      const result = firstReview(RATING.good);

      expect(result.itemId).toBe(ITEM_ID);
      expect(result.state).toBe('learning');
      expect(result.reps).toBe(1);
      expect(result.lapses).toBe(0);
      expect(result.lastReview).toEqual(NOW);
      expect(result.due).toEqual(at(NOW, 10 * MINUTE_MS));
      expect(result.stability).toBeGreaterThan(0);
      expect(result.difficulty).toBeGreaterThan(0);
    });

    it('should start learning with due 1 minute later when rated Again', () => {
      const result = firstReview(RATING.again);

      expect(result.state).toBe('learning');
      expect(result.due).toEqual(at(NOW, MINUTE_MS));
      expect(result.lastReview).toEqual(NOW);
      expect(result.stability).toBeGreaterThan(0);
    });

    it('should graduate straight to review at least one day later when rated Easy', () => {
      const result = firstReview(RATING.easy);

      expect(result.state).toBe('review');
      expect(result.due.getTime()).toBeGreaterThanOrEqual(at(NOW, DAY_MS).getTime());
      expect(result.reps).toBe(1);
      expect(result.stability).toBeGreaterThan(0);
    });

    it('should order due dates Again < Hard <= Good < Easy', () => {
      const again = firstReview(RATING.again).due.getTime();
      const hard = firstReview(RATING.hard).due.getTime();
      const good = firstReview(RATING.good).due.getTime();
      const easy = firstReview(RATING.easy).due.getTime();

      expect(again).toBeLessThan(hard);
      expect(hard).toBeLessThanOrEqual(good);
      expect(good).toBeLessThan(easy);
    });
  });

  describe('weak seeds', () => {
    it('should record one lapse and schedule no later or stronger than a plain Good when a weak seed is first reviewed', () => {
      const seeded = firstReview(RATING.good, [ITEM_ID]);
      const plain = firstReview(RATING.good, []);

      expect(seeded.lapses).toBe(1);
      expect(plain.lapses).toBe(0);
      expect(seeded.itemId).toBe(ITEM_ID);
      expect(seeded.lastReview).toEqual(NOW);
      expect(seeded.due.getTime()).toBeLessThanOrEqual(plain.due.getTime());
      expect(seeded.stability).toBeGreaterThan(0);
      expect(seeded.stability).toBeLessThanOrEqual(plain.stability);
    });

    it('should not treat the item as a weak seed when only another id is in weakSeeds', () => {
      const result = firstReview(RATING.good, [OTHER_ID]);

      expect(result.lapses).toBe(0);
      expect(result).toEqual(firstReview(RATING.good, []));
    });

    it('should ignore weakSeeds when the item already has a state', () => {
      const withSeed = schedule({ itemId: ITEM_ID, state: matureState(NOW), rating: RATING.good, now: NOW, weakSeeds: [ITEM_ID] });
      const withoutSeed = schedule({ itemId: ITEM_ID, state: matureState(NOW), rating: RATING.good, now: NOW, weakSeeds: [] });

      expect(withSeed).toEqual(withoutSeed);
    });
  });

  describe('mature review state', () => {
    it('should lapse into relearning due within a day when a mature review is rated Again', () => {
      const result = schedule({ itemId: ITEM_ID, state: matureState(NOW), rating: RATING.again, now: NOW, weakSeeds: [] });

      expect(result.state).toBe('relearning');
      expect(result.lapses).toBe(1);
      expect(result.reps).toBe(6);
      expect(result.lastReview).toEqual(NOW);
      expect(result.due.getTime()).toBeGreaterThan(NOW.getTime());
      expect(result.due.getTime()).toBeLessThan(at(NOW, DAY_MS).getTime());
    });

    it('should stay in review with higher stability due more than a day later when a mature review is rated Good', () => {
      const result = schedule({ itemId: ITEM_ID, state: matureState(NOW), rating: RATING.good, now: NOW, weakSeeds: [] });

      expect(result.state).toBe('review');
      expect(result.stability).toBeGreaterThan(10);
      expect(result.reps).toBe(6);
      expect(result.lapses).toBe(0);
      expect(result.lastReview).toEqual(NOW);
      expect(result.due.getTime()).toBeGreaterThan(at(NOW, DAY_MS).getTime());
    });

    it('should raise difficulty more after Again than after Good on a mature review', () => {
      const again = schedule({ itemId: ITEM_ID, state: matureState(NOW), rating: RATING.again, now: NOW, weakSeeds: [] });
      const good = schedule({ itemId: ITEM_ID, state: matureState(NOW), rating: RATING.good, now: NOW, weakSeeds: [] });

      expect(again.difficulty).toBeGreaterThan(good.difficulty);
      expect(again.stability).toBeLessThan(good.stability);
    });
  });

  describe('chained reviews', () => {
    it('should never shrink the interval and reach at least one day when Good is given at each due date', () => {
      const gaps: Array<number> = [];
      let reviewedAt = NOW;
      let state: ReviewState | null = null;
      for (let i = 0; i < 5; i += 1) {
        const result: ReviewState = schedule({ itemId: ITEM_ID, state, rating: RATING.good, now: reviewedAt, weakSeeds: [] });
        expect(result.lastReview).toEqual(reviewedAt);
        expect(result.reps).toBe(i + 1);
        gaps.push(result.due.getTime() - reviewedAt.getTime());
        state = result;
        reviewedAt = result.due;
      }

      for (let i = 1; i < gaps.length; i += 1) {
        expect(gaps[i]).toBeGreaterThanOrEqual(gaps[i - 1] ?? Number.POSITIVE_INFINITY);
      }
      expect(gaps[gaps.length - 1]).toBeGreaterThanOrEqual(DAY_MS);
    });
  });

  describe('purity', () => {
    it('should not mutate the input state', () => {
      const input = matureState(NOW);
      const before = matureState(NOW);
      const frozen = Object.freeze(input);

      schedule({ itemId: ITEM_ID, state: frozen, rating: RATING.again, now: NOW, weakSeeds: [ITEM_ID] });

      expect(input).toEqual(before);
      expect(input.due.getTime()).toBe(before.due.getTime());
      expect(input.lastReview).toEqual(before.lastReview);
    });

    it('should return equal results when called twice with fresh but equal inputs', () => {
      const ratings: ReadonlyArray<Rating> = [RATING.again, RATING.hard, RATING.good, RATING.easy];
      const nows: ReadonlyArray<string> = ['2026-11-13T09:00:00Z', '2026-12-31T23:59:59Z', '2027-03-01T00:00:00Z'];
      for (const rating of ratings) {
        for (const iso of nows) {
          for (const withState of [false, true]) {
            const call = (): ReviewState => {
              const now = new Date(iso);
              return schedule({ itemId: ITEM_ID, state: withState ? matureState(now) : null, rating, now, weakSeeds: [ITEM_ID] });
            };
            expect(call()).toEqual(call());
          }
        }
      }
    });
  });
});
