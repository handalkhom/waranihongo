import type { CustomVocabItem } from '@wara/content/schema';
import type {
  Assessment,
  JournalEntry,
  ReviewLog,
  ReviewState,
  Session,
  UserProfile,
} from '@wara/core';
import { Dexie, type DexieOptions, type Table } from 'dexie';

export class WaraDb extends Dexie {
  readonly reviewStates: Table<ReviewState, string>;
  readonly reviewLogs: Table<ReviewLog, string>;
  readonly sessions: Table<Session, string>;
  readonly journal: Table<JournalEntry, string>;
  readonly assessments: Table<Assessment, string>;
  readonly profile: Table<UserProfile, 'me'>;
  readonly customContent: Table<CustomVocabItem, string>;

  constructor(name: string, options?: DexieOptions) {
    super(name, options);
    this.version(1).stores({
      reviewStates: 'itemId, due, state',
      reviewLogs: 'id, itemId, at',
      sessions: 'id, date',
      journal: 'id, date, status',
      assessments: 'id, date, kind',
      profile: 'id',
      customContent: 'id, type',
    });
    this.reviewStates = this.table('reviewStates');
    this.reviewLogs = this.table('reviewLogs');
    this.sessions = this.table('sessions');
    this.journal = this.table('journal');
    this.assessments = this.table('assessments');
    this.profile = this.table('profile');
    this.customContent = this.table('customContent');
  }
}
