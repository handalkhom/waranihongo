import type { ReviewState, Session, SessionActivity, SessionActivityKind } from '../domain';

function isPending(kind: SessionActivityKind, due: Date | undefined, now: Date): boolean {
  switch (kind) {
    case 'review':
      return due === undefined || due.getTime() <= now.getTime();
    case 'new':
      return due === undefined;
    case 'production':
      return true;
    default:
      return kind satisfies never;
  }
}

function markDone(
  activities: ReadonlyArray<SessionActivity>,
  from: number,
  to: number,
): ReadonlyArray<SessionActivity> {
  return activities.map((activity, index) =>
    index >= from && index < to ? { ...activity, done: true } : activity,
  );
}

export function resumeSession({
  session,
  states,
  now,
}: {
  readonly session: Session;
  readonly states: ReadonlyArray<ReviewState>;
  readonly now: Date;
}): { readonly session: Session; readonly queue: ReadonlyArray<string> } {
  const dueById: ReadonlyMap<string, Date> = new Map(states.map((state) => [state.itemId, state.due]));
  const next = session.activities
    .map((activity, index) => ({
      index,
      queue: activity.itemIds.filter((id) => isPending(activity.kind, dueById.get(id), now)),
    }))
    .slice(session.cursor)
    .find((candidate) => candidate.queue.length > 0);
  if (next === undefined) {
    const end = session.activities.length;
    return {
      session: {
        ...session,
        activities: markDone(session.activities, session.cursor, end),
        cursor: end,
        completed: true,
      },
      queue: [],
    };
  }
  if (next.index === session.cursor) return { session, queue: next.queue };
  return {
    session: {
      ...session,
      activities: markDone(session.activities, session.cursor, next.index),
      cursor: next.index,
    },
    queue: next.queue,
  };
}
