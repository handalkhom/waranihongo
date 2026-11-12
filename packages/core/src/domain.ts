import type { CustomVocabItem } from '@wara/content/schema';

export type LocalDate = string;

export const RATING = { again: 1, hard: 2, good: 3, easy: 4 } as const;
export type Rating = (typeof RATING)[keyof typeof RATING];

export type CardState = 'new' | 'learning' | 'review' | 'relearning';

export interface ReviewState {
  readonly itemId: string;
  readonly stability: number;
  readonly difficulty: number;
  readonly due: Date;
  readonly lastReview: Date | null;
  readonly reps: number;
  readonly lapses: number;
  readonly learningSteps: number;
  readonly state: CardState;
}

export interface ReviewLog {
  readonly id: string;
  readonly itemId: string;
  readonly at: Date;
  readonly rating: Rating;
  readonly elapsedMs: number;
  readonly confusedWith: string | null;
}

export type SessionActivityKind = 'review' | 'new' | 'production';

export interface SessionActivity {
  readonly kind: SessionActivityKind;
  readonly itemIds: ReadonlyArray<string>;
  readonly estimatedSec: number;
  readonly done: boolean;
}

export interface Session {
  readonly id: string;
  readonly date: LocalDate;
  readonly plannedMin: number;
  readonly actualMin: number;
  readonly activities: ReadonlyArray<SessionActivity>;
  readonly cursor: number;
  readonly completed: boolean;
}

export type JournalStatus = 'draft' | 'needs_review' | 'corrected';

export interface JournalSource {
  readonly anime: string;
  readonly episode: number | null;
}

export interface JournalCorrection {
  readonly sentence: string;
  readonly meaning: string;
  readonly note: string | null;
}

export interface JournalEntry {
  readonly id: string;
  readonly date: LocalDate;
  readonly source: JournalSource | null;
  readonly sentenceKana: string;
  readonly guess: string;
  readonly context: string | null;
  readonly status: JournalStatus;
  readonly correction: JournalCorrection | null;
  readonly extractedVocabIds: ReadonlyArray<string>;
}

export interface KanaExitAssessment {
  readonly id: string;
  readonly date: LocalDate;
  readonly kind: 'kana-exit';
  readonly passed: boolean;
  readonly correct: number;
  readonly total: number;
  readonly elapsedMs: number;
  readonly wrong: ReadonlyArray<string>;
}

export type JlptLevel = 'n5' | 'n4';

export interface JlptSimAssessment {
  readonly id: string;
  readonly date: LocalDate;
  readonly kind: 'jlpt-sim';
  readonly level: JlptLevel;
  readonly score: number;
}

export type Assessment = KanaExitAssessment | JlptSimAssessment;

export type RomajiAid = 'always' | 'on-demand' | 'off';

export type Theme = 'system' | 'light' | 'dark';

export interface UserProfile {
  readonly id: 'me';
  readonly name: string;
  readonly dailyTargetMin: number;
  readonly romajiAid: RomajiAid;
  readonly theme: Theme;
  readonly ttsVoiceUri: string | null;
  readonly startDate: LocalDate;
  readonly weakSeeds: ReadonlyArray<string>;
}

export interface ExportBundle {
  readonly format: 'wara-export';
  readonly version: 1;
  readonly exportedAt: Date;
  readonly profile: UserProfile | null;
  readonly reviewStates: ReadonlyArray<ReviewState>;
  readonly reviewLogs: ReadonlyArray<ReviewLog>;
  readonly sessions: ReadonlyArray<Session>;
  readonly journal: ReadonlyArray<JournalEntry>;
  readonly assessments: ReadonlyArray<Assessment>;
  readonly customContent: ReadonlyArray<CustomVocabItem>;
}
