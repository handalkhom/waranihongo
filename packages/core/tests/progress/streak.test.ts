import { describe, expect, it } from 'vitest';
import type { LocalDate, Session } from '../../src/domain';
import { streak } from '../../src/progress/streak';

const buildSessions = (
  entries: ReadonlyArray<readonly [LocalDate, boolean]>,
): ReadonlyArray<Session> =>
  entries.map(([date, completed], index) => ({
    id: `session-${String(index)}-${date}`,
    date,
    plannedMin: 15,
    actualMin: completed ? 15 : 4,
    activities: [],
    cursor: completed ? 0 : 1,
    completed,
  }));

const completedOn = (...dates: ReadonlyArray<LocalDate>): ReadonlyArray<Session> =>
  buildSessions(dates.map((date) => [date, true] as const));

describe('streak', () => {
  describe('counting completed days', () => {
    it('should return zero days and no forgiveness when there are no sessions', () => {
      expect(streak({ sessions: [], today: '2026-11-12' })).toEqual({
        days: 0,
        forgivenessUsedThisWeek: false,
      });
    });

    it('should return zero days when the only session today is incomplete', () => {
      expect(
        streak({ sessions: buildSessions([['2026-11-12', false]]), today: '2026-11-12' }),
      ).toEqual({ days: 0, forgivenessUsedThisWeek: false });
    });

    it('should count one day when only today has a completed session', () => {
      expect(streak({ sessions: completedOn('2026-11-12'), today: '2026-11-12' })).toEqual({
        days: 1,
        forgivenessUsedThisWeek: false,
      });
    });

    it('should count one day when only yesterday is completed and today has nothing yet', () => {
      expect(streak({ sessions: completedOn('2026-11-11'), today: '2026-11-12' })).toEqual({
        days: 1,
        forgivenessUsedThisWeek: false,
      });
    });

    it('should count three days when today, yesterday and the day before are completed', () => {
      expect(
        streak({
          sessions: completedOn('2026-11-10', '2026-11-12', '2026-11-11'),
          today: '2026-11-12',
        }),
      ).toEqual({ days: 3, forgivenessUsedThisWeek: false });
    });

    it('should count a day with two completed sessions once', () => {
      expect(
        streak({
          sessions: completedOn('2026-11-12', '2026-11-11', '2026-11-12', '2026-11-11'),
          today: '2026-11-12',
        }),
      ).toEqual({ days: 2, forgivenessUsedThisWeek: false });
    });

    it('should neither count nor break on an incomplete session today when yesterday and the day before are completed', () => {
      expect(
        streak({
          sessions: buildSessions([
            ['2026-11-12', false],
            ['2026-11-11', true],
            ['2026-11-10', true],
          ]),
          today: '2026-11-12',
        }),
      ).toEqual({ days: 2, forgivenessUsedThisWeek: false });
    });

    it('should treat a day with only incomplete sessions as missed', () => {
      expect(
        streak({
          sessions: buildSessions([
            ['2026-11-12', true],
            ['2026-11-11', false],
            ['2026-11-10', false],
            ['2026-11-09', true],
          ]),
          today: '2026-11-12',
        }),
      ).toEqual({ days: 1, forgivenessUsedThisWeek: false });
    });

    it('should return zero days when today, yesterday and the day before have no completed session even though older days do', () => {
      expect(
        streak({
          sessions: completedOn('2026-11-09', '2026-11-08', '2026-11-07'),
          today: '2026-11-12',
        }),
      ).toEqual({ days: 0, forgivenessUsedThisWeek: false });
    });
  });

  describe('forgiveness', () => {
    it('should forgive a single missed day inside the current ISO week and report it', () => {
      expect(
        streak({
          sessions: completedOn('2026-11-12', '2026-11-10', '2026-11-09'),
          today: '2026-11-12',
        }),
      ).toEqual({ days: 3, forgivenessUsedThisWeek: true });
    });

    it('should forgive a single missed day in the previous ISO week without reporting it for this week', () => {
      expect(
        streak({
          sessions: completedOn('2026-11-17', '2026-11-16', '2026-11-15', '2026-11-13'),
          today: '2026-11-17',
        }),
      ).toEqual({ days: 4, forgivenessUsedThisWeek: false });
    });

    it('should forgive a missed Sunday seen from the following Monday without reporting it for this week', () => {
      expect(
        streak({
          sessions: completedOn('2026-11-16', '2026-11-14', '2026-11-13'),
          today: '2026-11-16',
        }),
      ).toEqual({ days: 3, forgivenessUsedThisWeek: false });
    });

    it('should end the streak at two consecutive missed days', () => {
      expect(
        streak({
          sessions: completedOn('2026-11-12', '2026-11-09', '2026-11-08'),
          today: '2026-11-12',
        }),
      ).toEqual({ days: 1, forgivenessUsedThisWeek: false });
    });

    it('should end the streak at a second single gap in an ISO week whose forgiveness is already used', () => {
      expect(
        streak({
          sessions: completedOn('2026-11-15', '2026-11-13', '2026-11-11', '2026-11-10'),
          today: '2026-11-15',
        }),
      ).toEqual({ days: 2, forgivenessUsedThisWeek: true });
    });

    it('should forgive one single gap in each of two different ISO weeks', () => {
      expect(
        streak({
          sessions: completedOn('2026-11-17', '2026-11-15', '2026-11-14', '2026-11-12', '2026-11-11'),
          today: '2026-11-17',
        }),
      ).toEqual({ days: 5, forgivenessUsedThisWeek: true });
    });

    it('should forgive single gaps in two earlier ISO weeks without reporting forgiveness for this week', () => {
      expect(
        streak({
          sessions: completedOn(
            '2026-11-16',
            '2026-11-14',
            '2026-11-13',
            '2026-11-12',
            '2026-11-11',
            '2026-11-10',
            '2026-11-09',
            '2026-11-07',
          ),
          today: '2026-11-16',
        }),
      ).toEqual({ days: 8, forgivenessUsedThisWeek: false });
    });

    it('should keep the streak alive through a forgiven yesterday when today is not done yet', () => {
      expect(
        streak({
          sessions: buildSessions([
            ['2026-11-12', false],
            ['2026-11-10', true],
            ['2026-11-09', true],
          ]),
          today: '2026-11-12',
        }),
      ).toEqual({ days: 2, forgivenessUsedThisWeek: true });
    });

    it('should keep the streak alive through a forgiven yesterday in the previous ISO week without reporting it for this week', () => {
      expect(
        streak({ sessions: completedOn('2026-11-14', '2026-11-13'), today: '2026-11-16' }),
      ).toEqual({ days: 2, forgivenessUsedThisWeek: false });
    });
  });

  describe('calendar boundaries', () => {
    it('should forgive a gap on 2027-01-01 as part of ISO week 2026-W53 shared with today', () => {
      expect(
        streak({
          sessions: completedOn('2027-01-02', '2026-12-31', '2026-12-30'),
          today: '2027-01-02',
        }),
      ).toEqual({ days: 3, forgivenessUsedThisWeek: true });
    });

    it('should end the streak at a second gap in ISO week 2026-W53 even when the gaps fall in different calendar years', () => {
      expect(
        streak({
          sessions: completedOn(
            '2027-01-03',
            '2027-01-02',
            '2026-12-31',
            '2026-12-30',
            '2026-12-28',
            '2026-12-27',
          ),
          today: '2027-01-03',
        }),
      ).toEqual({ days: 4, forgivenessUsedThisWeek: true });
    });

    it('should count consecutive days across the month boundary', () => {
      expect(
        streak({
          sessions: completedOn('2026-12-02', '2026-12-01', '2026-11-30', '2026-11-29'),
          today: '2026-12-02',
        }),
      ).toEqual({ days: 4, forgivenessUsedThisWeek: false });
    });

    it('should ignore completed sessions dated after today', () => {
      expect(
        streak({
          sessions: completedOn('2026-11-14', '2026-11-13', '2026-11-12'),
          today: '2026-11-12',
        }),
      ).toEqual({ days: 1, forgivenessUsedThisWeek: false });
    });
  });

  it('should return equal results for identical inputs', () => {
    const sessions = completedOn('2026-11-12', '2026-11-10', '2026-11-09');
    expect(streak({ sessions, today: '2026-11-12' })).toEqual(
      streak({ sessions, today: '2026-11-12' }),
    );
    expect(streak({ sessions, today: '2026-11-12' })).toEqual({
      days: 3,
      forgivenessUsedThisWeek: true,
    });
  });
});
