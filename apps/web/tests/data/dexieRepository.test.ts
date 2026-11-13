import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it, onTestFinished } from 'vitest';
import type { CustomVocabItem } from '@wara/content/schema';
import {
  ImportFormatError,
  RATING,
  RepositoryError,
  type ExportBundle,
  type JlptSimAssessment,
  type JournalEntry,
  type KanaExitAssessment,
  type Repository,
  type ReviewLog,
  type ReviewState,
  type Session,
  type UserProfile,
} from '@wara/core';
import { WaraDb } from '@/data/db';
import { createDexieRepository } from '@/data/dexieRepository';
import { exportBundleSchema } from '@/data/exportBundleSchema';

const NOW = '2026-11-13T09:00:00.000Z';
const CUSTOM_ID = 'vocab:custom:0f8b3c2e-5a1d-4e7f-9b6a-2c4d8e1f3a5b';

const open = (): { readonly db: WaraDb; readonly repository: Repository } => {
  const db = new WaraDb(`wara-test-${crypto.randomUUID()}`, {
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
  onTestFinished(() => {
    db.close();
  });
  return { db, repository: createDexieRepository(db, () => new Date(NOW)) };
};

const rejectionOf = async <E extends Error>(
  promise: Promise<unknown>,
  type: new (...args: never[]) => E,
): Promise<E> => {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(type);
  if (!(error instanceof type)) {
    return expect.unreachable(`expected a rejection with ${type.name}`);
  }
  return error;
};

const asJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

const reviewState = (
  itemId: string,
  due: string,
  overrides: Partial<ReviewState> = {},
): ReviewState => ({
  itemId,
  stability: 3.2,
  difficulty: 5.1,
  due: new Date(due),
  lastReview: new Date('2026-11-12T08:30:00.000Z'),
  reps: 3,
  lapses: 1,
  learningSteps: 0,
  state: 'review',
  ...overrides,
});

const newState = (itemId: string, due: string): ReviewState =>
  reviewState(itemId, due, {
    stability: 0,
    difficulty: 0,
    lastReview: null,
    reps: 0,
    lapses: 0,
    state: 'new',
  });

const reviewLog = (id: string, itemId: string, overrides: Partial<ReviewLog> = {}): ReviewLog => ({
  id,
  itemId,
  at: new Date('2026-11-13T08:59:00.000Z'),
  rating: RATING.good,
  elapsedMs: 2100,
  confusedWith: null,
  ...overrides,
});

const session = (overrides: Partial<Session> = {}): Session => ({
  id: 'session-1',
  date: '2026-11-13',
  plannedMin: 20,
  actualMin: 0,
  activities: [
    { kind: 'review', itemIds: ['kana:hira:ね', 'kana:hira:れ'], estimatedSec: 16, done: false },
    { kind: 'new', itemIds: ['vocab:other:ともだち'], estimatedSec: 30, done: false },
  ],
  cursor: 0,
  completed: false,
  ...overrides,
});

const unclonableSession = (overrides: Partial<Session> = {}): Session => {
  const withFunction = { ...session(overrides), extra: () => undefined };
  return withFunction;
};

const profile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: 'me',
  name: 'Handal',
  dailyTargetMin: 20,
  romajiAid: 'on-demand',
  theme: 'system',
  ttsVoiceUri: null,
  startDate: '2026-11-01',
  weakSeeds: ['kana:kata:ソ', 'kana:hira:ね'],
  ...overrides,
});

const journalEntry = (overrides: Partial<JournalEntry> = {}): JournalEntry => ({
  id: 'journal-1',
  date: '2026-11-12',
  source: { anime: 'Frieren', episode: 3 },
  sentenceKana: 'ともだちになろう',
  guess: 'ayo jadi teman',
  context: 'di akhir episode',
  status: 'draft',
  correction: null,
  extractedVocabIds: ['vocab:other:ともだち'],
  ...overrides,
});

const kanaExit = (overrides: Partial<KanaExitAssessment> = {}): KanaExitAssessment => ({
  id: 'assessment-1',
  date: '2026-11-10',
  kind: 'kana-exit',
  passed: false,
  correct: 48,
  total: 50,
  elapsedMs: 290000,
  wrong: ['kana:kata:ソ', 'kana:kata:ン'],
  ...overrides,
});

const jlptSim = (overrides: Partial<JlptSimAssessment> = {}): JlptSimAssessment => ({
  id: 'assessment-2',
  date: '2026-11-11',
  kind: 'jlpt-sim',
  level: 'n5',
  score: 0.72,
  ...overrides,
});

const customItem = (): CustomVocabItem => ({
  type: 'vocab',
  source: 'custom',
  id: CUSTOM_ID,
  level: 'custom',
  phase: 1,
  tags: ['anime'],
  data: { word: '頑張る', reading: 'がんばる', meaning: 'berusaha keras' },
});

const importedBundle = (): ExportBundle => ({
  format: 'wara-export',
  version: 1,
  exportedAt: new Date('2026-11-01T12:00:00.000Z'),
  profile: profile({ name: 'Dari berkas', dailyTargetMin: 30 }),
  reviewStates: [
    newState(CUSTOM_ID, '2026-11-14T09:00:00.000Z'),
    reviewState('kana:hira:ね', '2026-11-15T09:00:00.000Z'),
  ],
  reviewLogs: [
    reviewLog('log-b', 'kana:hira:ね', { rating: RATING.hard }),
    reviewLog('log-a', 'kana:hira:ね', { rating: RATING.again, confusedWith: 'kana:hira:れ' }),
  ],
  sessions: [session({ id: 'session-imported', date: '2026-11-12', completed: true })],
  journal: [
    journalEntry({
      id: 'journal-imported',
      status: 'corrected',
      correction: { sentence: 'ともだちになろう', meaning: 'mari berteman', note: null },
      extractedVocabIds: ['vocab:other:ともだち', CUSTOM_ID],
    }),
  ],
  assessments: [jlptSim({ id: 'assessment-y' }), kanaExit({ id: 'assessment-x' })],
  customContent: [customItem()],
});

const seedOldDatabase = async (repository: Repository): Promise<void> => {
  await repository.saveProfile(profile({ name: 'Lama' }));
  await repository.commitReview(
    [reviewState('kana:hira:れ', '2026-11-13T08:00:00.000Z')],
    [reviewLog('log-old', 'kana:hira:れ')],
    session({ id: 'session-old', date: '2026-11-13' }),
  );
  await repository.saveJournalEntry(journalEntry({ id: 'journal-old' }));
  await repository.saveAssessment(kanaExit({ id: 'assessment-old' }));
};

describe('getReviewStates', () => {
  it('should return the states in the order of the requested ids, skipping ids without a row', async () => {
    const { repository } = open();
    const ne = reviewState('kana:hira:ね', '2026-11-14T09:00:00.000Z');
    const re = reviewState('kana:hira:れ', '2026-11-15T09:00:00.000Z');
    const so = reviewState('kana:kata:ソ', '2026-11-16T09:00:00.000Z');
    await repository.commitReview([ne, re, so], []);

    expect(
      await repository.getReviewStates(['kana:kata:ソ', 'kana:kata:ン', 'kana:hira:ね']),
    ).toEqual([so, ne]);
    expect(await repository.getReviewStates([])).toEqual([]);
  });

  it('should return due and lastReview as Date and keep a null lastReview null', async () => {
    const { repository } = open();
    const reviewed = reviewState('kana:hira:ね', '2026-11-14T09:00:00.000Z');
    const fresh = newState(CUSTOM_ID, '2026-11-13T09:00:00.000Z');
    await repository.commitReview([reviewed, fresh], []);

    const [first, second] = await repository.getReviewStates(['kana:hira:ね', CUSTOM_ID]);

    expect(first?.due).toBeInstanceOf(Date);
    expect(first?.lastReview).toBeInstanceOf(Date);
    expect(first?.due.toISOString()).toBe('2026-11-14T09:00:00.000Z');
    expect(first?.lastReview?.toISOString()).toBe('2026-11-12T08:30:00.000Z');
    expect(second?.due).toBeInstanceOf(Date);
    expect(second?.lastReview).toBeNull();
  });
});

describe('getDueStates', () => {
  it('should include a state due exactly at before and exclude one due a millisecond later', async () => {
    const { repository } = open();
    const dueNow = reviewState('kana:hira:ね', '2026-11-13T09:00:00.000Z');
    const dueLater = reviewState('kana:hira:れ', '2026-11-13T09:00:00.001Z');
    await repository.commitReview([dueNow, dueLater], []);

    expect(await repository.getDueStates(new Date(NOW))).toEqual([dueNow]);
  });

  it('should order due states by due ascending and ties by itemId ascending', async () => {
    const { repository } = open();
    const re = reviewState('kana:hira:れ', '2026-11-13T08:30:00.000Z');
    const n = reviewState('kana:kata:ン', '2026-11-13T08:00:00.000Z');
    const ne = reviewState('kana:hira:ね', '2026-11-13T08:30:00.000Z');
    const so = reviewState('kana:kata:ソ', '2026-11-13T07:00:00.000Z');
    const notDue = newState(CUSTOM_ID, '2026-11-14T09:00:00.000Z');
    await repository.commitReview([re, notDue, n, ne, so], []);

    expect(await repository.getDueStates(new Date(NOW))).toEqual([so, n, ne, re]);
  });
});

describe('commitReview', () => {
  it('should write every state and every log and no session row when committed without a session', async () => {
    const { db, repository } = open();
    const ne = reviewState('kana:hira:ね', '2026-11-14T09:00:00.000Z');
    const re = reviewState('kana:hira:れ', '2026-11-15T09:00:00.000Z');
    const log = reviewLog('log-1', 'kana:hira:ね');
    await repository.commitReview([ne, re], [log]);

    expect(await db.reviewStates.toArray()).toEqual([ne, re]);
    expect(await db.reviewLogs.toArray()).toEqual([log]);
    expect(await db.sessions.count()).toBe(0);
  });

  it('should write the session row in the same commit when a session is given', async () => {
    const { db, repository } = open();
    const ne = reviewState('kana:hira:ね', '2026-11-14T09:00:00.000Z');
    const log = reviewLog('log-1', 'kana:hira:ね');
    const running = session({ cursor: 1 });
    await repository.commitReview([ne], [log], running);

    expect(await db.reviewStates.toArray()).toEqual([ne]);
    expect(await db.reviewLogs.toArray()).toEqual([log]);
    expect(await db.sessions.toArray()).toEqual([running]);
  });

  it('should replace the state of an existing itemId and accumulate logs with new ids', async () => {
    const { db, repository } = open();
    const first = reviewState('kana:hira:ね', '2026-11-14T09:00:00.000Z', { reps: 3 });
    const second = reviewState('kana:hira:ね', '2026-11-20T09:00:00.000Z', { reps: 4 });
    const firstLog = reviewLog('log-1', 'kana:hira:ね');
    const secondLog = reviewLog('log-2', 'kana:hira:ね', { at: new Date(NOW) });
    await repository.commitReview([first], [firstLog]);
    await repository.commitReview([second], [secondLog]);

    expect(await db.reviewStates.toArray()).toEqual([second]);
    expect(await db.reviewLogs.toArray()).toEqual([firstLog, secondLog]);
  });

  it('should replace a log committed again with an existing id', async () => {
    const { db, repository } = open();
    const ne = reviewState('kana:hira:ね', '2026-11-14T09:00:00.000Z');
    await repository.commitReview([ne], [reviewLog('log-1', 'kana:hira:ね', { rating: RATING.again })]);
    const corrected = reviewLog('log-1', 'kana:hira:ね', { rating: RATING.good });
    await repository.commitReview([ne], [corrected]);

    expect(await db.reviewLogs.toArray()).toEqual([corrected]);
  });

  it('should write a confusion partner state that has no log of its own', async () => {
    const { db, repository } = open();
    const so = reviewState('kana:kata:ソ', '2026-11-13T09:10:00.000Z', { lapses: 2 });
    const partner = reviewState('kana:kata:ン', '2026-11-13T09:00:00.000Z');
    const log = reviewLog('log-1', 'kana:kata:ソ', {
      rating: RATING.again,
      confusedWith: 'kana:kata:ン',
    });
    await repository.commitReview([so, partner], [log]);

    expect(await db.reviewStates.toArray()).toEqual([so, partner]);
    expect(await db.reviewLogs.toArray()).toEqual([log]);
  });

  it('should leave the database as it was after an empty commit without a session', async () => {
    const { db, repository } = open();
    const ne = reviewState('kana:hira:ね', '2026-11-14T09:00:00.000Z');
    const log = reviewLog('log-1', 'kana:hira:ね');
    await repository.commitReview([ne], [log]);
    await repository.commitReview([], []);

    expect(await db.reviewStates.toArray()).toEqual([ne]);
    expect(await db.reviewLogs.toArray()).toEqual([log]);
    expect(await db.sessions.count()).toBe(0);
  });

  it('should reject with RepositoryError naming the logs without a state, in log order, and write nothing', async () => {
    const { db, repository } = open();
    const error = await rejectionOf(
      repository.commitReview(
        [reviewState('kana:hira:ね', '2026-11-14T09:00:00.000Z')],
        [
          reviewLog('log-1', 'kana:hira:れ'),
          reviewLog('log-2', 'kana:hira:ね'),
          reviewLog('log-3', 'kana:kata:ソ'),
        ],
        session(),
      ),
      RepositoryError,
    );

    expect(error.operation).toBe('commitReview');
    expect(error.ids).toEqual(['kana:hira:れ', 'kana:kata:ソ']);
    expect(await db.reviewStates.count()).toBe(0);
    expect(await db.reviewLogs.count()).toBe(0);
    expect(await db.sessions.count()).toBe(0);
  });

  it('should write no state and no log and keep the existing state when the session write fails', async () => {
    const { db, repository } = open();
    const before = reviewState('kana:hira:ね', '2026-11-14T09:00:00.000Z', { reps: 3 });
    const beforeLog = reviewLog('log-0', 'kana:hira:ね');
    await repository.commitReview([before], [beforeLog]);

    const error = await rejectionOf(
      repository.commitReview(
        [
          reviewState('kana:hira:ね', '2026-11-20T09:00:00.000Z', { reps: 4 }),
          reviewState('kana:hira:れ', '2026-11-13T09:00:00.000Z'),
        ],
        [reviewLog('log-1', 'kana:hira:ね')],
        unclonableSession(),
      ),
      RepositoryError,
    );

    expect(error.operation).toBe('commitReview');
    expect(error.ids).toEqual(['kana:hira:ね', 'kana:hira:れ']);
    expect(error.cause).toBeDefined();
    expect(await db.reviewStates.toArray()).toEqual([before]);
    expect(await db.reviewLogs.toArray()).toEqual([beforeLog]);
    expect(await db.sessions.count()).toBe(0);
  });

  it('should write no state and no session when a log write fails', async () => {
    const { db, repository } = open();
    const before = reviewState('kana:hira:ね', '2026-11-14T09:00:00.000Z', { reps: 3 });
    await repository.commitReview([before], []);
    const withFunction = { ...reviewLog('log-1', 'kana:hira:ね'), extra: () => undefined };
    const unclonableLog: ReviewLog = withFunction;

    const error = await rejectionOf(
      repository.commitReview(
        [
          reviewState('kana:hira:ね', '2026-11-20T09:00:00.000Z', { reps: 4 }),
          reviewState('kana:hira:れ', '2026-11-13T09:00:00.000Z'),
        ],
        [reviewLog('log-0', 'kana:hira:れ'), unclonableLog],
        session(),
      ),
      RepositoryError,
    );

    expect(error.operation).toBe('commitReview');
    expect(await db.reviewStates.toArray()).toEqual([before]);
    expect(await db.reviewLogs.count()).toBe(0);
    expect(await db.sessions.count()).toBe(0);
  });
});

describe('saveSession', () => {
  it('should create a session row and replace it by id when the session is finished', async () => {
    const { db, repository } = open();
    const started = session();
    await repository.saveSession(started);

    expect(await db.sessions.toArray()).toEqual([started]);

    const finished = session({ cursor: 2, actualMin: 19, completed: true });
    await repository.saveSession(finished);

    expect(await db.sessions.toArray()).toEqual([finished]);
  });

  it('should reject with RepositoryError naming the session id when the write fails', async () => {
    const { db, repository } = open();
    const error = await rejectionOf(
      repository.saveSession(unclonableSession({ id: 'session-broken' })),
      RepositoryError,
    );

    expect(error.operation).toBe('saveSession');
    expect(error.ids).toEqual(['session-broken']);
    expect(await db.sessions.count()).toBe(0);
  });
});

describe('getSessions', () => {
  const seedSessions = async (repository: Repository): Promise<void> => {
    await repository.saveSession(session({ id: 'session-a', date: '2026-11-13' }));
    await repository.saveSession(session({ id: 'session-c', date: '2026-11-12' }));
    await repository.saveSession(session({ id: 'session-0', date: '2026-11-11' }));
    await repository.saveSession(session({ id: 'session-b', date: '2026-11-12' }));
  };

  it('should return the sessions from the given date inclusive, ordered by date then id', async () => {
    const { repository } = open();
    await seedSessions(repository);

    const sessions = await repository.getSessions('2026-11-12');

    expect(sessions.map(({ id }) => id)).toEqual(['session-b', 'session-c', 'session-a']);
    expect(sessions[0]).toEqual(session({ id: 'session-b', date: '2026-11-12' }));
  });

  it('should return every session ordered by date then id when from is omitted', async () => {
    const { repository } = open();
    await seedSessions(repository);

    expect((await repository.getSessions()).map(({ id }) => id)).toEqual([
      'session-0',
      'session-b',
      'session-c',
      'session-a',
    ]);
  });
});

describe('getProfile and saveProfile', () => {
  it('should return null before a save, the saved profile after, and the replacement after a second save', async () => {
    const { repository } = open();

    expect(await repository.getProfile()).toBeNull();

    await repository.saveProfile(profile());

    expect(await repository.getProfile()).toEqual(profile());

    await repository.saveProfile(profile({ name: 'Handal K', romajiAid: 'off' }));

    expect(await repository.getProfile()).toEqual(profile({ name: 'Handal K', romajiAid: 'off' }));
  });
});

describe('saveJournalEntry and saveAssessment', () => {
  it('should upsert a journal entry by id', async () => {
    const { db, repository } = open();
    const corrected = journalEntry({
      status: 'corrected',
      correction: { sentence: 'ともだちになろう', meaning: 'mari berteman', note: null },
    });
    const other = journalEntry({ id: 'journal-2', date: '2026-11-13', source: null });
    await repository.saveJournalEntry(journalEntry());
    await repository.saveJournalEntry(other);
    await repository.saveJournalEntry(corrected);

    expect(await db.journal.toArray()).toEqual([corrected, other]);
  });

  it('should upsert assessments of both kinds by id', async () => {
    const { db, repository } = open();
    const passed = kanaExit({ passed: true, correct: 50, wrong: [] });
    await repository.saveAssessment(kanaExit());
    await repository.saveAssessment(jlptSim());
    await repository.saveAssessment(passed);

    expect(await db.assessments.toArray()).toEqual([passed, jlptSim()]);
  });
});

describe('exportAll', () => {
  it('should export every table in primary-key order with the injected now as exportedAt', async () => {
    const { repository } = open();
    const so = reviewState('kana:kata:ソ', '2026-11-14T09:00:00.000Z');
    const ne = reviewState('kana:hira:ね', '2026-11-15T09:00:00.000Z');
    const soLog = reviewLog('log-2', 'kana:kata:ソ', { rating: RATING.again });
    const neLog = reviewLog('log-1', 'kana:hira:ね');
    await repository.saveProfile(profile());
    await repository.commitReview([so], [soLog], session({ id: 'session-2', date: '2026-11-13' }));
    await repository.commitReview([ne], [neLog]);
    await repository.saveSession(session({ id: 'session-1', date: '2026-11-12', completed: true }));
    await repository.saveJournalEntry(journalEntry({ id: 'journal-2' }));
    await repository.saveJournalEntry(journalEntry({ id: 'journal-1' }));
    await repository.saveAssessment(jlptSim({ id: 'assessment-2' }));
    await repository.saveAssessment(kanaExit({ id: 'assessment-1' }));

    expect(await repository.exportAll()).toEqual({
      format: 'wara-export',
      version: 1,
      exportedAt: new Date(NOW),
      profile: profile(),
      reviewStates: [ne, so],
      reviewLogs: [neLog, soLog],
      sessions: [
        session({ id: 'session-1', date: '2026-11-12', completed: true }),
        session({ id: 'session-2', date: '2026-11-13' }),
      ],
      journal: [journalEntry({ id: 'journal-1' }), journalEntry({ id: 'journal-2' })],
      assessments: [kanaExit({ id: 'assessment-1' }), jlptSim({ id: 'assessment-2' })],
      customContent: [],
    });
  });

  it('should export a null profile alongside the rows when no profile was saved', async () => {
    const { repository } = open();
    const ne = reviewState('kana:hira:ね', '2026-11-15T09:00:00.000Z');
    await repository.commitReview([ne], []);

    const exported = await repository.exportAll();

    expect(exported.profile).toBeNull();
    expect(exported.reviewStates).toEqual([ne]);
  });

  it('should survive a JSON round trip through exportBundleSchema unchanged', async () => {
    const { repository } = open();
    await repository.importAll(asJson(importedBundle()));
    await repository.saveSession(session({ id: 'session-running', date: '2026-11-13' }));

    const exported = await repository.exportAll();

    expect(exported.reviewStates).toHaveLength(2);
    expect(exported.customContent).toEqual([customItem()]);
    expect(exportBundleSchema.parse(JSON.parse(JSON.stringify(exported)))).toEqual(exported);
  });
});

describe('importAll', () => {
  it('should replace the whole database with the bundle and export it back with now as exportedAt', async () => {
    const { repository } = open();
    await seedOldDatabase(repository);

    expect((await repository.getSessions()).map(({ id }) => id)).toEqual(['session-old']);

    await repository.importAll(asJson(importedBundle()));

    const bundle = importedBundle();
    expect(await repository.exportAll()).toEqual({
      ...bundle,
      exportedAt: new Date(NOW),
      reviewStates: [
        reviewState('kana:hira:ね', '2026-11-15T09:00:00.000Z'),
        newState(CUSTOM_ID, '2026-11-14T09:00:00.000Z'),
      ],
      reviewLogs: [
        reviewLog('log-a', 'kana:hira:ね', { rating: RATING.again, confusedWith: 'kana:hira:れ' }),
        reviewLog('log-b', 'kana:hira:ね', { rating: RATING.hard }),
      ],
      assessments: [kanaExit({ id: 'assessment-x' }), jlptSim({ id: 'assessment-y' })],
    });
    expect(await repository.getReviewStates(['kana:hira:れ'])).toEqual([]);
  });

  it('should leave no profile after importing a bundle whose profile is null', async () => {
    const { repository } = open();
    await repository.saveProfile(profile());

    expect(await repository.getProfile()).toEqual(profile());

    await repository.importAll(asJson({ ...importedBundle(), profile: null }));

    expect(await repository.getProfile()).toBeNull();
    expect((await repository.exportAll()).customContent).toEqual([customItem()]);
  });

  it('should reject an invalid bundle with ImportFormatError carrying the dotted path and leave the database untouched', async () => {
    const { repository } = open();
    await seedOldDatabase(repository);
    const before = await repository.exportAll();
    const bundle = importedBundle();
    const invalid = asJson({
      ...bundle,
      reviewStates: [{ ...reviewState('kana:hira:ね', NOW), due: 'bukan-tanggal' }, ...bundle.reviewStates],
    });

    const error = await rejectionOf(repository.importAll(invalid), ImportFormatError);

    expect(error.issues.map(({ path }) => path)).toContain('reviewStates.0.due');
    expect(error.issues.every(({ message }) => typeof message === 'string' && message.length > 0)).toBe(true);
    expect(await repository.exportAll()).toEqual(before);
    expect(before.reviewStates).toHaveLength(1);
  });

  it('should reject null with ImportFormatError', async () => {
    const { repository } = open();

    await expect(repository.importAll(null)).rejects.toBeInstanceOf(ImportFormatError);
  });

  it('should keep the journal sentence out of the error message and issues when a journal entry is rejected', async () => {
    const { repository } = open();
    const invalid = asJson({
      ...importedBundle(),
      journal: [journalEntry({ sentenceKana: 'ひみつのことば' }), { ...journalEntry({ id: 'journal-bad', sentenceKana: 'ひみつのことば' }), status: 'published' }],
    });

    const error = await rejectionOf(repository.importAll(invalid), ImportFormatError);

    expect(error.issues.map(({ path }) => path)).toContain('journal.1.status');
    expect(error.message).not.toContain('ひみつのことば');
    expect(JSON.stringify(error.issues)).not.toContain('ひみつのことば');
  });
});
