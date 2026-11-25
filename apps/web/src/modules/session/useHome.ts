import { useLiveQuery } from 'dexie-react-hooks';
import { contentBundle } from '@wara/content';
import { kanaExitGate, streak, type KanaExitGate } from '@wara/core';
import { useRepository } from '@/data/repositoryContext';
import { useSettings } from '@/hooks/useSettings';
import { toLocalDate } from '@/utils/localDate';

export type HomeToday = 'none' | 'unfinished' | 'completed';

export type Home =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready';
      readonly name: string;
      readonly streakDays: number;
      readonly dueCount: number;
      readonly today: HomeToday;
      readonly kanaExit: KanaExitGate;
    };

const ALL_IDS: ReadonlyArray<string> = contentBundle.items.map((item) => item.id);

export function useHome(): Home {
  const settings = useSettings();
  const repository = useRepository();
  const sessions = useLiveQuery(() => repository.getSessions(), [repository]);
  const due = useLiveQuery(() => repository.getDueStates(new Date()), [repository]);
  const states = useLiveQuery(() => repository.getReviewStates(ALL_IDS), [repository]);
  const assessments = useLiveQuery(() => repository.getAssessments(), [repository]);

  if (
    settings.status === 'loading' ||
    settings.profile === null ||
    sessions === undefined ||
    due === undefined ||
    states === undefined ||
    assessments === undefined
  ) {
    return { status: 'loading' };
  }
  const today = toLocalDate(new Date());
  const sessionsToday = sessions.filter((session) => session.date === today);
  return {
    status: 'ready',
    name: settings.profile.name,
    streakDays: streak({ sessions, today }).days,
    dueCount: due.length,
    today: sessionsToday.some((session) => !session.completed)
      ? 'unfinished'
      : sessionsToday.length > 0
        ? 'completed'
        : 'none',
    kanaExit: kanaExitGate({ items: contentBundle.items, states, assessments }),
  };
}
