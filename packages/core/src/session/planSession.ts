import type { ContentItem, Phase } from '@wara/content/schema';
import type { LocalDate, ReviewState, Session, SessionActivity, SessionActivityKind, UserProfile } from '../domain';
import {
  BACKLOG_HALVE_NEW_ABOVE,
  BACKLOG_STOP_NEW_ABOVE,
  NEW_ITEMS_PER_DAY,
  NEW_ITEM_SEC,
  PRODUCTION_ITEM_SEC,
  REVIEW_ITEM_SEC,
  SESSION_SPLIT_MIN,
} from './defaults';

export interface SessionPlan {
  readonly plannedMin: number;
  readonly activities: ReadonlyArray<SessionActivity>;
}

type VocabContentItem = Extract<ContentItem, { type: 'vocab' }>;

const PER_ITEM_SEC = {
  review: REVIEW_ITEM_SEC,
  new: NEW_ITEM_SEC,
  production: PRODUCTION_ITEM_SEC,
} as const satisfies Record<SessionActivityKind, number>;

const isVocabSuperseded = (item: VocabContentItem): boolean => {
  switch (item.source) {
    case 'content':
      return item.supersededBy !== undefined;
    case 'custom':
      return false;
    default:
      return item satisfies never;
  }
};

const isSuperseded = (item: ContentItem): boolean => {
  switch (item.type) {
    case 'kana':
      return item.supersededBy !== undefined;
    case 'vocab':
      return isVocabSuperseded(item);
    default:
      return item satisfies never;
  }
};

const poolRank = (item: ContentItem): number => {
  switch (item.type) {
    case 'kana':
      return 0;
    case 'vocab':
      return 1;
    default:
      return item satisfies never;
  }
};

const compareDue = (a: ReviewState, b: ReviewState): number => {
  const byDue = a.due.getTime() - b.due.getTime();
  if (byDue !== 0) return byDue;
  if (a.itemId === b.itemId) return 0;
  return a.itemId < b.itemId ? -1 : 1;
};

const newLimit = (phase: Phase, dueCount: number): number => {
  const base = phase === 0 ? NEW_ITEMS_PER_DAY.phase0 : NEW_ITEMS_PER_DAY.later;
  if (dueCount > BACKLOG_STOP_NEW_ABOVE) return 0;
  if (dueCount > BACKLOG_HALVE_NEW_ABOVE) return Math.floor(base / 2);
  return base;
};

const introducedOn = (sessions: ReadonlyArray<Session>, today: LocalDate): ReadonlyArray<string> =>
  sessions
    .filter((entry) => entry.date === today)
    .flatMap((entry) => entry.activities)
    .filter((activity) => activity.kind === 'new')
    .flatMap((activity) => activity.itemIds);

const orderPool = (pool: ReadonlyArray<ContentItem>, weakSeeds: ReadonlyArray<string>): ReadonlyArray<string> => {
  const poolIds = new Set(pool.map((item) => item.id));
  const seeds = weakSeeds.filter((id, index) => poolIds.has(id) && weakSeeds.indexOf(id) === index);
  const seedIds = new Set(seeds);
  const rest = pool
    .filter((item) => !seedIds.has(item.id))
    .toSorted((a, b) => poolRank(a) - poolRank(b))
    .map((item) => item.id);
  return [...seeds, ...rest];
};

const shuffle = (ids: ReadonlyArray<string>, rng: () => number): ReadonlyArray<string> => {
  let result = ids;
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const atI = result[i];
    const atJ = result[j];
    if (atI === undefined || atJ === undefined) continue;
    result = result.with(i, atJ).with(j, atI);
  }
  return result;
};

const activity = (kind: SessionActivityKind, itemIds: ReadonlyArray<string>): SessionActivity => ({
  kind,
  itemIds,
  estimatedSec: itemIds.length * PER_ITEM_SEC[kind],
  done: false,
});

export function planSession(input: {
  readonly availableMin: number;
  readonly items: ReadonlyArray<ContentItem>;
  readonly states: ReadonlyArray<ReviewState>;
  readonly profile: UserProfile;
  readonly phase: Phase;
  readonly sessionsToday: ReadonlyArray<Session>;
  readonly now: Date;
  readonly today: LocalDate;
  readonly rng: () => number;
}): SessionPlan {
  const { availableMin, items, states, profile, phase, sessionsToday, now, today, rng } = input;
  const secs = availableMin * 60;
  const eligible = new Map(items.filter((item) => !isSuperseded(item)).map((item) => [item.id, item]));

  const due = states
    .filter((state) => state.due.getTime() <= now.getTime() && eligible.has(state.itemId))
    .toSorted(compareDue);
  const reviewIds = due.slice(0, Math.floor(secs / REVIEW_ITEM_SEC)).map((state) => state.itemId);

  const remaining = secs - reviewIds.length * REVIEW_ITEM_SEC;
  const productionTime = Math.min(
    remaining,
    (secs * SESSION_SPLIT_MIN.production) /
      (SESSION_SPLIT_MIN.review + SESSION_SPLIT_MIN.newMaterial + SESSION_SPLIT_MIN.production),
  );

  const introducedToday = new Set(introducedOn(sessionsToday, today));
  const withState = new Set(states.map((state) => state.itemId));
  const pool = orderPool(
    [...eligible.values()].filter(
      (item) => !withState.has(item.id) && item.phase <= phase && !introducedToday.has(item.id),
    ),
    profile.weakSeeds,
  );
  const newIds = pool.slice(
    0,
    Math.min(
      Math.floor((remaining - productionTime) / NEW_ITEM_SEC),
      Math.max(0, newLimit(phase, due.length) - introducedToday.size),
    ),
  );

  const productionIds = shuffle(newIds.length > 0 ? newIds : reviewIds, rng).slice(
    0,
    Math.floor(productionTime / PRODUCTION_ITEM_SEC),
  );

  return {
    plannedMin: availableMin,
    activities: [activity('review', reviewIds), activity('new', newIds), activity('production', productionIds)].filter(
      (entry) => entry.itemIds.length > 0,
    ),
  };
}
