import type {
  Assessment,
  ExportBundle,
  JournalEntry,
  LocalDate,
  ReviewLog,
  ReviewState,
  Session,
  UserProfile,
} from './domain';

export interface Repository {
  readonly getReviewStates: (ids: ReadonlyArray<string>) => Promise<ReadonlyArray<ReviewState>>;
  readonly getDueStates: (before: Date) => Promise<ReadonlyArray<ReviewState>>;
  readonly commitReview: (
    states: ReadonlyArray<ReviewState>,
    logs: ReadonlyArray<ReviewLog>,
    session?: Session,
  ) => Promise<void>;
  readonly saveSession: (session: Session) => Promise<void>;
  readonly getSessions: (from?: LocalDate) => Promise<ReadonlyArray<Session>>;
  readonly getProfile: () => Promise<UserProfile | null>;
  readonly saveProfile: (profile: UserProfile) => Promise<void>;
  readonly saveJournalEntry: (entry: JournalEntry) => Promise<void>;
  readonly saveAssessment: (assessment: Assessment) => Promise<void>;
  readonly exportAll: () => Promise<ExportBundle>;
  readonly importAll: (bundle: unknown) => Promise<void>;
}
