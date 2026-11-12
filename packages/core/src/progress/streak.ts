import type { LocalDate, Session } from '../domain';

const MS_PER_DAY = 86_400_000;

type Walk = { readonly days: number; readonly forgivenWeeks: ReadonlyArray<number> };

const toEpochDay = (date: LocalDate): number => Date.parse(date) / MS_PER_DAY;

const isoWeekOf = (epochDay: number): number => epochDay - ((((epochDay + 3) % 7) + 7) % 7);

const walkBack = (completedDays: ReadonlySet<number>, day: number, walk: Walk): Walk => {
  if (completedDays.has(day)) {
    return walkBack(completedDays, day - 1, { ...walk, days: walk.days + 1 });
  }
  if (!completedDays.has(day - 1) || walk.forgivenWeeks.includes(isoWeekOf(day))) {
    return walk;
  }
  return walkBack(completedDays, day - 1, {
    ...walk,
    forgivenWeeks: [...walk.forgivenWeeks, isoWeekOf(day)],
  });
};

export function streak(input: {
  readonly sessions: ReadonlyArray<Session>;
  readonly today: LocalDate;
}): { readonly days: number; readonly forgivenessUsedThisWeek: boolean } {
  const todayDay = toEpochDay(input.today);
  const completedDays = new Set(
    input.sessions
      .filter((session) => session.completed && toEpochDay(session.date) <= todayDay)
      .map((session) => toEpochDay(session.date)),
  );
  const walk = walkBack(
    completedDays,
    completedDays.has(todayDay) ? todayDay : todayDay - 1,
    { days: 0, forgivenWeeks: [] },
  );
  return {
    days: walk.days,
    forgivenessUsedThisWeek: walk.forgivenWeeks.includes(isoWeekOf(todayDay)),
  };
}
