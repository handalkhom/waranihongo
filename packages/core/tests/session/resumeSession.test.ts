import { describe, expect, it } from 'vitest';
import type { ReviewState, Session, SessionActivity, SessionActivityKind } from '../../src/domain';
import { resumeSession } from '../../src/session/resumeSession';

const NOW = new Date('2026-11-18T09:00:00Z');
const PAST = new Date('2026-11-17T09:00:00Z');
const FUTURE = new Date('2026-11-19T09:00:00Z');
const JUST_AFTER_NOW = new Date(NOW.getTime() + 1);

const state = (itemId: string, due: Date): ReviewState => ({
  itemId,
  stability: 3,
  difficulty: 5,
  due,
  lastReview: PAST,
  reps: 2,
  lapses: 0,
  learningSteps: 0,
  state: 'review',
});

const activity = (
  kind: SessionActivityKind,
  itemIds: ReadonlyArray<string>,
  done = false,
): SessionActivity => ({ kind, itemIds, estimatedSec: itemIds.length * 10, done });

const session = (activities: ReadonlyArray<SessionActivity>, cursor = 0): Session => ({
  id: 'session-1',
  date: '2026-11-18',
  plannedMin: 15,
  actualMin: 4,
  activities,
  cursor,
  completed: false,
});

describe('resumeSession', () => {
  it('should return the same session and queue every due item in order when a fresh session opens on a due review activity', () => {
    const input = session([
      activity('review', ['kana:hira:あ', 'kana:hira:い', 'kana:hira:う']),
      activity('new', ['kana:hira:え']),
    ]);
    const states = [
      state('kana:hira:い', PAST),
      state('kana:hira:あ', PAST),
      state('kana:hira:う', NOW),
    ];

    const result = resumeSession({ session: input, states, now: NOW });

    expect(result.queue).toEqual(['kana:hira:あ', 'kana:hira:い', 'kana:hira:う']);
    expect(result.session).toBe(input);
  });

  it('should keep items due exactly now or without a state and drop items due after now when a review activity is partly answered', () => {
    const input = session([
      activity('review', ['kana:hira:あ', 'kana:hira:い', 'kana:hira:う', 'kana:hira:え', 'kana:hira:お']),
    ]);
    const states = [
      state('kana:hira:あ', FUTURE),
      state('kana:hira:い', NOW),
      state('kana:hira:え', PAST),
      state('kana:hira:お', JUST_AFTER_NOW),
    ];

    const result = resumeSession({ session: input, states, now: NOW });

    expect(result.queue).toEqual(['kana:hira:い', 'kana:hira:う', 'kana:hira:え']);
    expect(result.session).toBe(input);
  });

  it('should move the cursor to the new activity with only stateless items and mark the review activity done when the review activity is fully answered', () => {
    const review = activity('review', ['kana:hira:あ', 'kana:hira:い']);
    const fresh = activity('new', ['kana:hira:か', 'kana:hira:き', 'kana:hira:く']);
    const production = activity('production', ['kana:hira:あ']);
    const input = session([review, fresh, production]);
    const states = [
      state('kana:hira:あ', FUTURE),
      state('kana:hira:い', JUST_AFTER_NOW),
      state('kana:hira:き', FUTURE),
    ];

    const result = resumeSession({ session: input, states, now: NOW });

    expect(result.queue).toEqual(['kana:hira:か', 'kana:hira:く']);
    expect(result.session).toEqual({
      ...input,
      activities: [{ ...review, done: true }, fresh, production],
      cursor: 1,
      completed: false,
    });
  });

  it('should treat an item with a past-due state as not pending when it sits in a new activity', () => {
    const input = session([activity('new', ['kana:hira:か', 'kana:hira:き'])]);
    const states = [state('kana:hira:か', PAST)];

    const result = resumeSession({ session: input, states, now: NOW });

    expect(result.queue).toEqual(['kana:hira:き']);
    expect(result.session).toBe(input);
  });

  it('should skip a new activity and mark it done when every one of its items already has a state', () => {
    const fresh = activity('new', ['kana:hira:か', 'kana:hira:き']);
    const review = activity('review', ['kana:hira:あ']);
    const input = session([fresh, review]);
    const states = [
      state('kana:hira:か', FUTURE),
      state('kana:hira:き', PAST),
      state('kana:hira:あ', PAST),
    ];

    const result = resumeSession({ session: input, states, now: NOW });

    expect(result.queue).toEqual(['kana:hira:あ']);
    expect(result.session).toEqual({
      ...input,
      activities: [{ ...fresh, done: true }, review],
      cursor: 1,
    });
  });

  it('should queue every item of a production activity in order when all of its items have states not yet due', () => {
    const input = session([activity('production', ['vocab:n5:猫', 'vocab:n5:犬', 'vocab:n5:水'])]);
    const states = [
      state('vocab:n5:猫', FUTURE),
      state('vocab:n5:犬', FUTURE),
      state('vocab:n5:水', JUST_AFTER_NOW),
    ];

    const result = resumeSession({ session: input, states, now: NOW });

    expect(result.queue).toEqual(['vocab:n5:猫', 'vocab:n5:犬', 'vocab:n5:水']);
    expect(result.session).toBe(input);
  });

  it('should complete the session with the cursor past the last activity and every activity done when nothing from the cursor on is pending', () => {
    const review = activity('review', ['kana:hira:あ', 'kana:hira:い']);
    const fresh = activity('new', ['kana:hira:か']);
    const input = session([review, fresh]);
    const states = [
      state('kana:hira:あ', FUTURE),
      state('kana:hira:い', FUTURE),
      state('kana:hira:か', FUTURE),
    ];

    const result = resumeSession({ session: input, states, now: NOW });

    expect(result.queue).toEqual([]);
    expect(result.session).toEqual({
      ...input,
      activities: [
        { ...review, done: true },
        { ...fresh, done: true },
      ],
      cursor: 2,
      completed: true,
    });
  });

  it('should leave activities before the cursor untouched and not return to them when the cursor starts in the middle', () => {
    const earlierPending = activity('review', ['kana:hira:あ']);
    const earlierNew = activity('new', ['kana:hira:か']);
    const answered = activity('review', ['kana:hira:い']);
    const production = activity('production', ['vocab:n5:猫', 'vocab:n5:犬']);
    const after = activity('new', ['kana:hira:さ']);
    const input = session([earlierPending, earlierNew, answered, production, after], 2);
    const states = [
      state('kana:hira:い', FUTURE),
      state('vocab:n5:猫', FUTURE),
      state('vocab:n5:犬', FUTURE),
    ];

    const result = resumeSession({ session: input, states, now: NOW });

    expect(result.queue).toEqual(['vocab:n5:猫', 'vocab:n5:犬']);
    expect(result.session).toEqual({
      ...input,
      activities: [earlierPending, earlierNew, { ...answered, done: true }, production, after],
      cursor: 3,
    });
  });

  it('should leave activities before the cursor untouched when the session completes from a middle cursor', () => {
    const earlier = activity('review', ['kana:hira:あ']);
    const answered = activity('review', ['kana:hira:い']);
    const fresh = activity('new', ['kana:hira:か']);
    const input = session([earlier, answered, fresh], 1);
    const states = [state('kana:hira:い', FUTURE), state('kana:hira:か', PAST)];

    const result = resumeSession({ session: input, states, now: NOW });

    expect(result.queue).toEqual([]);
    expect(result.session).toEqual({
      ...input,
      activities: [earlier, { ...answered, done: true }, { ...fresh, done: true }],
      cursor: 3,
      completed: true,
    });
  });

  it('should mark the session completed with an empty queue when the cursor already equals the number of activities', () => {
    const review = activity('review', ['kana:hira:あ'], true);
    const input = session([review], 1);

    const result = resumeSession({ session: input, states: [], now: NOW });

    expect(result.queue).toEqual([]);
    expect(result.session).toEqual({ ...input, activities: [review], cursor: 1, completed: true });
  });

  it('should mark the session completed with an empty queue when it has no activities', () => {
    const input = session([]);

    const result = resumeSession({ session: input, states: [], now: NOW });

    expect(result.queue).toEqual([]);
    expect(result.session).toEqual({ ...input, activities: [], cursor: 0, completed: true });
  });

  it('should ignore states of items outside the activity when deciding what is pending', () => {
    const input = session([activity('review', ['kana:hira:あ', 'kana:hira:い'])]);
    const states = [
      state('kana:hira:か', FUTURE),
      state('kana:hira:き', FUTURE),
      state('kana:hira:あい', FUTURE),
    ];

    const result = resumeSession({ session: input, states, now: NOW });

    expect(result.queue).toEqual(['kana:hira:あ', 'kana:hira:い']);
    expect(result.session).toBe(input);
  });

  it('should preserve id, date, plannedMin and actualMin when the cursor moves', () => {
    const input: Session = {
      id: 'session-xyz',
      date: '2026-11-17',
      plannedMin: 25,
      actualMin: 11,
      activities: [activity('review', ['kana:hira:あ']), activity('new', ['kana:hira:か'])],
      cursor: 0,
      completed: false,
    };
    const states = [state('kana:hira:あ', FUTURE)];

    const result = resumeSession({ session: input, states, now: NOW });

    expect(result.session.cursor).toBe(1);
    expect(result.session.id).toBe('session-xyz');
    expect(result.session.date).toBe('2026-11-17');
    expect(result.session.plannedMin).toBe(25);
    expect(result.session.actualMin).toBe(11);
  });

  it('should not mutate frozen inputs when it moves the cursor and marks activities done', () => {
    const review = Object.freeze(activity('review', Object.freeze(['kana:hira:あ'])));
    const fresh = Object.freeze(activity('new', Object.freeze(['kana:hira:か'])));
    const input: Session = Object.freeze(session(Object.freeze([review, fresh])));
    const states: ReadonlyArray<ReviewState> = Object.freeze([
      Object.freeze(state('kana:hira:あ', FUTURE)),
    ]);

    const result = resumeSession({ session: input, states, now: NOW });

    expect(result.session.cursor).toBe(1);
    expect(result.queue).toEqual(['kana:hira:か']);
    expect(input).toEqual(
      session([activity('review', ['kana:hira:あ']), activity('new', ['kana:hira:か'])]),
    );
    expect(states).toEqual([state('kana:hira:あ', FUTURE)]);
  });

  it('should return equal results when called twice with the same inputs', () => {
    const input = session([
      activity('review', ['kana:hira:あ', 'kana:hira:い']),
      activity('new', ['kana:hira:か', 'kana:hira:き']),
    ]);
    const states = [state('kana:hira:あ', FUTURE), state('kana:hira:い', FUTURE)];

    const first = resumeSession({ session: input, states, now: NOW });
    const second = resumeSession({ session: input, states, now: NOW });

    expect(first).toEqual(second);
    expect(first.queue).toEqual(['kana:hira:か', 'kana:hira:き']);
    expect(first.session.cursor).toBe(1);
  });
});
