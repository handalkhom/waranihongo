import { describe, expect, it } from 'vitest';
import type { Session, SessionActivity } from '../../src/domain';
import { advanceSession } from '../../src/session/advanceSession';

const REVIEW: SessionActivity = {
  kind: 'review',
  itemIds: ['kana:hira:ね', 'kana:hira:れ', 'kana:hira:わ'],
  estimatedSec: 90,
  done: false,
};

const NEW: SessionActivity = {
  kind: 'new',
  itemIds: ['kana:kata:ン', 'kana:kata:ソ'],
  estimatedSec: 120,
  done: false,
};

const PRODUCTION: SessionActivity = {
  kind: 'production',
  itemIds: ['vocab:n5:ねこ'],
  estimatedSec: 60,
  done: false,
};

const SESSION: Session = {
  id: 'session-2026-11-18-1',
  date: '2026-11-18',
  plannedMin: 10,
  actualMin: 1,
  activities: [REVIEW, NEW, PRODUCTION],
  cursor: 0,
  completed: false,
};

const sessionAt = (cursor: number, actualMin = 1): Session => ({
  ...SESSION,
  actualMin,
  cursor,
  activities: SESSION.activities.map((activity, index) => ({ ...activity, done: index < cursor })),
});

const frozenSession = (session: Session): Session =>
  Object.freeze({
    ...session,
    activities: Object.freeze(
      session.activities.map((activity) => Object.freeze({ ...activity, itemIds: Object.freeze([...activity.itemIds]) })),
    ),
  });

describe('advanceSession', () => {
  describe('queue', () => {
    it('should drop the head and keep the rest in order when the answer is correct mid-queue', () => {
      const result = advanceSession({
        session: SESSION,
        queue: ['kana:hira:ね', 'kana:hira:れ', 'kana:hira:わ'],
        correct: true,
        elapsedMs: 4000,
      });

      expect(result.queue).toEqual(['kana:hira:れ', 'kana:hira:わ']);
    });

    it('should move the head to the end of the queue when the answer is wrong mid-queue', () => {
      const result = advanceSession({
        session: SESSION,
        queue: ['kana:hira:ね', 'kana:hira:れ', 'kana:hira:わ'],
        correct: false,
        elapsedMs: 4000,
      });

      expect(result.queue).toEqual(['kana:hira:れ', 'kana:hira:わ', 'kana:hira:ね']);
    });

    it('should keep the single remaining item queued when it is answered wrong and close the activity once it is answered correctly', () => {
      const wrong = advanceSession({
        session: sessionAt(1),
        queue: ['kana:kata:ソ'],
        correct: false,
        elapsedMs: 4000,
      });
      const right = advanceSession({ session: wrong.session, queue: wrong.queue, correct: true, elapsedMs: 4000 });

      expect(wrong.queue).toEqual(['kana:kata:ソ']);
      expect(wrong.session.cursor).toBe(1);
      expect(right.queue).toEqual([]);
      expect(right.session.cursor).toBe(2);
    });

    it('should return the session and the queue unchanged when the queue is empty', () => {
      const session = sessionAt(1);

      const result = advanceSession({ session, queue: [], correct: true, elapsedMs: 4000 });

      expect(result.session).toEqual(session);
      expect(result.queue).toEqual([]);
    });
  });

  describe('actualMin', () => {
    it('should add elapsedMs as fractional minutes when the answer is correct', () => {
      const result = advanceSession({
        session: sessionAt(0, 1),
        queue: ['kana:hira:ね', 'kana:hira:れ'],
        correct: true,
        elapsedMs: 30000,
      });

      expect(result.session.actualMin).toBeCloseTo(1.5, 10);
    });

    it('should add elapsedMs as fractional minutes when the answer is wrong', () => {
      const result = advanceSession({
        session: sessionAt(0, 2),
        queue: ['kana:hira:ね', 'kana:hira:れ'],
        correct: false,
        elapsedMs: 6000,
      });

      expect(result.session.actualMin).toBeCloseTo(2.1, 10);
    });

    it('should add elapsedMs when the answer closes the activity', () => {
      const result = advanceSession({
        session: sessionAt(1, 3),
        queue: ['kana:kata:ソ'],
        correct: true,
        elapsedMs: 90000,
      });

      expect(result.session.actualMin).toBeCloseTo(4.5, 10);
    });

    it('should accumulate over consecutive answers', () => {
      const first = advanceSession({
        session: sessionAt(0, 0),
        queue: ['kana:hira:ね', 'kana:hira:れ'],
        correct: false,
        elapsedMs: 15000,
      });
      const second = advanceSession({ session: first.session, queue: first.queue, correct: true, elapsedMs: 45000 });

      expect(second.session.actualMin).toBeCloseTo(1, 10);
      expect(second.queue).toEqual(['kana:hira:ね']);
    });

    it('should leave actualMin unchanged when elapsedMs is 0 while still advancing the queue', () => {
      const result = advanceSession({
        session: sessionAt(0, 1.25),
        queue: ['kana:hira:ね', 'kana:hira:れ'],
        correct: true,
        elapsedMs: 0,
      });

      expect(result.session.actualMin).toBe(1.25);
      expect(result.queue).toEqual(['kana:hira:れ']);
    });
  });

  describe('activity completion', () => {
    it('should keep cursor, completed, and every done flag when the queue is not yet empty after a correct answer', () => {
      const session = sessionAt(1);

      const result = advanceSession({
        session,
        queue: ['kana:kata:ン', 'kana:kata:ソ'],
        correct: true,
        elapsedMs: 3000,
      });

      expect(result.queue).toEqual(['kana:kata:ソ']);
      expect(result.session.cursor).toBe(1);
      expect(result.session.completed).toBe(false);
      expect(result.session.activities.map((activity) => activity.done)).toEqual([true, false, false]);
    });

    it('should keep cursor and done flags when a wrong answer on a single item leaves it queued', () => {
      const result = advanceSession({
        session: sessionAt(2),
        queue: ['vocab:n5:ねこ'],
        correct: false,
        elapsedMs: 3000,
      });

      expect(result.queue).toEqual(['vocab:n5:ねこ']);
      expect(result.session.actualMin).toBeCloseTo(1.05, 10);
      expect(result.session.cursor).toBe(2);
      expect(result.session.completed).toBe(false);
      expect(result.session.activities.map((activity) => activity.done)).toEqual([true, true, false]);
    });

    it('should mark the cursor activity done and move the cursor without completing when the last item of a non-final activity is correct', () => {
      const result = advanceSession({
        session: sessionAt(0),
        queue: ['kana:hira:わ'],
        correct: true,
        elapsedMs: 3000,
      });

      expect(result.queue).toEqual([]);
      expect(result.session.cursor).toBe(1);
      expect(result.session.completed).toBe(false);
      expect(result.session.activities.map((activity) => activity.done)).toEqual([true, false, false]);
    });

    it('should mark only the cursor activity done when a middle activity closes', () => {
      const result = advanceSession({
        session: sessionAt(1),
        queue: ['kana:kata:ソ'],
        correct: true,
        elapsedMs: 3000,
      });

      expect(result.session.cursor).toBe(2);
      expect(result.session.completed).toBe(false);
      expect(result.session.activities.map((activity) => activity.done)).toEqual([true, true, false]);
    });

    it('should complete the session when the last item of the final activity is correct', () => {
      const result = advanceSession({
        session: sessionAt(2),
        queue: ['vocab:n5:ねこ'],
        correct: true,
        elapsedMs: 3000,
      });

      expect(result.queue).toEqual([]);
      expect(result.session.cursor).toBe(3);
      expect(result.session.completed).toBe(true);
      expect(result.session.activities.map((activity) => activity.done)).toEqual([true, true, true]);
    });

    it('should complete a single-activity session when its last item is correct', () => {
      const session: Session = { ...SESSION, activities: [PRODUCTION] };

      const result = advanceSession({ session, queue: ['vocab:n5:ねこ'], correct: true, elapsedMs: 3000 });

      expect(result.session.cursor).toBe(1);
      expect(result.session.completed).toBe(true);
      expect(result.session.activities).toEqual([{ ...PRODUCTION, done: true }]);
    });
  });

  describe('preservation', () => {
    it('should preserve id, date, plannedMin, and every activity kind, itemIds, and estimatedSec when an activity closes', () => {
      const session = sessionAt(0);

      const result = advanceSession({ session, queue: ['kana:hira:わ'], correct: true, elapsedMs: 30000 });

      expect(result.session).toEqual({
        ...session,
        actualMin: 1.5,
        cursor: 1,
        activities: [{ ...REVIEW, done: true }, NEW, PRODUCTION],
      });
    });

    it('should not mutate frozen inputs and leave them equal to their originals', () => {
      const original = sessionAt(0);
      const session = frozenSession(original);
      const queue: ReadonlyArray<string> = Object.freeze(['kana:hira:わ']);

      const result = advanceSession({ session, queue, correct: true, elapsedMs: 3000 });

      expect(result.session.cursor).toBe(1);
      expect(session).toEqual(original);
      expect(queue).toEqual(['kana:hira:わ']);
    });

    it('should not mutate a frozen queue when a wrong answer rotates it', () => {
      const session = frozenSession(sessionAt(0));
      const queue: ReadonlyArray<string> = Object.freeze(['kana:hira:ね', 'kana:hira:れ']);

      const result = advanceSession({ session, queue, correct: false, elapsedMs: 3000 });

      expect(result.queue).toEqual(['kana:hira:れ', 'kana:hira:ね']);
      expect(queue).toEqual(['kana:hira:ね', 'kana:hira:れ']);
    });

    it('should return equal results for the same inputs', () => {
      const input = {
        session: sessionAt(0),
        queue: ['kana:hira:ね', 'kana:hira:れ'],
        correct: false,
        elapsedMs: 12000,
      };

      const first = advanceSession(input);
      const second = advanceSession(input);

      expect(first).toEqual(second);
      expect(first.queue).toEqual(['kana:hira:れ', 'kana:hira:ね']);
    });
  });
});
