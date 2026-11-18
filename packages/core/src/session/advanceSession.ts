import type { Session } from '../domain';

export function advanceSession({
  session,
  queue,
  correct,
  elapsedMs,
}: {
  readonly session: Session;
  readonly queue: ReadonlyArray<string>;
  readonly correct: boolean;
  readonly elapsedMs: number;
}): { readonly session: Session; readonly queue: ReadonlyArray<string> } {
  const [head, ...tail] = queue;
  if (head === undefined) {
    return { session, queue };
  }
  const nextQueue = correct ? tail : [...tail, head];
  const timed: Session = { ...session, actualMin: session.actualMin + elapsedMs / 60000 };
  if (nextQueue.length > 0) {
    return { session: timed, queue: nextQueue };
  }
  const cursor = session.cursor + 1;
  return {
    session: {
      ...timed,
      activities: session.activities.map((activity, index) =>
        index === session.cursor ? { ...activity, done: true } : activity,
      ),
      cursor,
      completed: cursor === session.activities.length,
    },
    queue: nextQueue,
  };
}
