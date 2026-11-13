import { createEmptyCard, fsrs, generatorParameters, Rating as FsrsRating, State } from 'ts-fsrs';
import type { Card, Grade } from 'ts-fsrs';
import { RATING } from '../domain';
import type { CardState, Rating, ReviewState } from '../domain';
import { FSRS_DESIRED_RETENTION, FSRS_ENABLE_FUZZ } from '../session/defaults';

const scheduler = fsrs(generatorParameters({ request_retention: FSRS_DESIRED_RETENTION, enable_fuzz: FSRS_ENABLE_FUZZ }));

const toFsrsState = (state: CardState): State => {
  switch (state) {
    case 'new':
      return State.New;
    case 'learning':
      return State.Learning;
    case 'review':
      return State.Review;
    case 'relearning':
      return State.Relearning;
    default:
      return state satisfies never;
  }
};

const fromFsrsState = (state: State): CardState => {
  switch (state) {
    case State.New:
      return 'new';
    case State.Learning:
      return 'learning';
    case State.Review:
      return 'review';
    case State.Relearning:
      return 'relearning';
    default:
      return state satisfies never;
  }
};

const toGrade = (rating: Rating): Grade => {
  switch (rating) {
    case RATING.again:
      return FsrsRating.Again;
    case RATING.hard:
      return FsrsRating.Hard;
    case RATING.good:
      return FsrsRating.Good;
    case RATING.easy:
      return FsrsRating.Easy;
    default:
      return rating satisfies never;
  }
};

const toCard = (state: ReviewState): Card => ({
  ...createEmptyCard(state.due),
  due: state.due,
  stability: state.stability,
  difficulty: state.difficulty,
  scheduled_days: state.lastReview === null ? 0 : Math.round((state.due.getTime() - state.lastReview.getTime()) / 86_400_000),
  learning_steps: state.learningSteps,
  reps: state.reps,
  lapses: state.lapses,
  state: toFsrsState(state.state),
  ...(state.lastReview === null ? {} : { last_review: state.lastReview }),
});

const fromCard = (itemId: string, card: Card): ReviewState => ({
  itemId,
  stability: card.stability,
  difficulty: card.difficulty,
  due: card.due,
  lastReview: card.last_review ?? null,
  reps: card.reps,
  lapses: card.lapses,
  learningSteps: card.learning_steps,
  state: fromFsrsState(card.state),
});

const startingCard = (itemId: string, now: Date, weakSeeds: ReadonlyArray<string>): Card => {
  if (!weakSeeds.includes(itemId)) {
    return createEmptyCard(now);
  }
  return { ...scheduler.next(createEmptyCard(now), now, FsrsRating.Again).card, lapses: 1 };
};

export function schedule(input: {
  readonly itemId: string;
  readonly state: ReviewState | null;
  readonly rating: Rating;
  readonly now: Date;
  readonly weakSeeds: ReadonlyArray<string>;
}): ReviewState {
  const card = input.state === null ? startingCard(input.itemId, input.now, input.weakSeeds) : toCard(input.state);
  return fromCard(input.itemId, scheduler.next(card, input.now, toGrade(input.rating)).card);
}
