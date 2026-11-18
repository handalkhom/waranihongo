import { afterEach, describe, expect, it, vi } from 'vitest';
import { toLocalDate } from '@/utils/localDate';

describe('toLocalDate', () => {
  it('should return the same day at 23:59:59.999 local time', () => {
    expect(toLocalDate(new Date(2026, 10, 16, 23, 59, 59, 999))).toBe('2026-11-16');
  });

  it('should return the next day at 00:00:00.000 local time', () => {
    expect(toLocalDate(new Date(2026, 10, 17, 0, 0, 0, 0))).toBe('2026-11-17');
  });

  it('should change day exactly one millisecond across local midnight', () => {
    const lastMillisecond = new Date(2026, 10, 16, 23, 59, 59, 999);
    expect([
      toLocalDate(lastMillisecond),
      toLocalDate(new Date(lastMillisecond.getTime() + 1)),
    ]).toEqual(['2026-11-16', '2026-11-17']);
  });

  it('should zero-pad a single-digit month and day', () => {
    expect(toLocalDate(new Date(2026, 0, 5, 12, 0, 0, 0))).toBe('2026-01-05');
  });

  it('should zero-pad September the 9th', () => {
    expect(toLocalDate(new Date(2026, 8, 9, 8, 30, 0, 0))).toBe('2026-09-09');
  });

  it('should keep the old year at 23:59:59.999 on 31 December', () => {
    expect(toLocalDate(new Date(2026, 11, 31, 23, 59, 59, 999))).toBe('2026-12-31');
  });

  it('should roll month and year over at 00:00 on 1 January', () => {
    expect(toLocalDate(new Date(2027, 0, 1, 0, 0, 0, 0))).toBe('2027-01-01');
  });

  it('should return 29 February in a leap year', () => {
    expect(toLocalDate(new Date(2028, 1, 29, 10, 0, 0, 0))).toBe('2028-02-29');
  });

  it('should format the result as YYYY-MM-DD', () => {
    expect(toLocalDate(new Date(2026, 2, 3, 4, 5, 6, 7))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  describe('in a time zone whose date differs from UTC', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('should return the local next day in Asia/Tokyo when UTC is still on the previous day', () => {
      vi.stubEnv('TZ', 'Asia/Tokyo');
      const now = new Date(Date.UTC(2026, 10, 16, 20, 0, 0, 0));
      expect(now.toISOString().slice(0, 10)).toBe('2026-11-16');
      expect(now.getHours()).toBe(5);
      expect(toLocalDate(now)).toBe('2026-11-17');
    });

    it('should return the local previous day in America/Los_Angeles when UTC has already moved on', () => {
      vi.stubEnv('TZ', 'America/Los_Angeles');
      const now = new Date(Date.UTC(2026, 10, 17, 3, 0, 0, 0));
      expect(now.toISOString().slice(0, 10)).toBe('2026-11-17');
      expect(now.getHours()).toBe(19);
      expect(toLocalDate(now)).toBe('2026-11-16');
    });
  });
});
