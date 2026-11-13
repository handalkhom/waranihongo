import {
  ImportFormatError,
  RepositoryError,
  type ExportBundle,
  type Repository,
  type ReviewState,
} from '@wara/core';
import { Dexie } from 'dexie';
import type { WaraDb } from './db';
import { exportBundleSchema } from './exportBundleSchema';

const wrapStorageFailure = async <T>(
  operation: string,
  ids: ReadonlyArray<string>,
  run: () => Promise<T>,
): Promise<T> => {
  try {
    return await run();
  } catch (error) {
    if (error instanceof Dexie.DexieError) {
      throw new RepositoryError({ operation, ids, cause: error });
    }
    throw error;
  }
};

const isReviewState = (state: ReviewState | undefined): state is ReviewState =>
  state !== undefined;

export const createDexieRepository = (db: WaraDb, now: () => Date): Repository => {
  const tables = [
    db.reviewStates,
    db.reviewLogs,
    db.sessions,
    db.journal,
    db.assessments,
    db.profile,
    db.customContent,
  ];

  return {
    getReviewStates: async (ids) => (await db.reviewStates.bulkGet([...ids])).filter(isReviewState),

    getDueStates: (before) => db.reviewStates.where('due').belowOrEqual(before).toArray(),

    commitReview: async (states, logs, session) => {
      const stateIds = new Set(states.map(({ itemId }) => itemId));
      const orphanLogs = logs.filter(({ itemId }) => !stateIds.has(itemId));
      if (orphanLogs.length > 0) {
        throw new RepositoryError({
          operation: 'commitReview',
          ids: orphanLogs.map(({ itemId }) => itemId),
          cause: null,
        });
      }
      await wrapStorageFailure(
        'commitReview',
        states.map(({ itemId }) => itemId),
        () =>
          db.transaction('rw', [db.reviewStates, db.reviewLogs, db.sessions], async () => {
            await db.reviewStates.bulkPut(states);
            await db.reviewLogs.bulkPut(logs);
            if (session !== undefined) {
              await db.sessions.put(session);
            }
          }),
      );
    },

    saveSession: async (session) => {
      await wrapStorageFailure('saveSession', [session.id], () => db.sessions.put(session));
    },

    getSessions: (from) =>
      from === undefined
        ? db.sessions.orderBy('date').toArray()
        : db.sessions.where('date').aboveOrEqual(from).toArray(),

    getProfile: async () => (await db.profile.get('me')) ?? null,

    saveProfile: async (profile) => {
      await wrapStorageFailure('saveProfile', [profile.id], () => db.profile.put(profile));
    },

    saveJournalEntry: async (entry) => {
      await wrapStorageFailure('saveJournalEntry', [entry.id], () => db.journal.put(entry));
    },

    saveAssessment: async (assessment) => {
      await wrapStorageFailure('saveAssessment', [assessment.id], () =>
        db.assessments.put(assessment),
      );
    },

    exportAll: () =>
      db.transaction(
        'r',
        tables,
        async (): Promise<ExportBundle> => ({
          format: 'wara-export',
          version: 1,
          exportedAt: now(),
          profile: (await db.profile.get('me')) ?? null,
          reviewStates: await db.reviewStates.toArray(),
          reviewLogs: await db.reviewLogs.toArray(),
          sessions: await db.sessions.toArray(),
          journal: await db.journal.toArray(),
          assessments: await db.assessments.toArray(),
          customContent: await db.customContent.toArray(),
        }),
      ),

    importAll: async (bundle) => {
      const parsed = exportBundleSchema.safeParse(bundle);
      if (!parsed.success) {
        throw new ImportFormatError(
          parsed.error.issues.map((issue) => ({
            path: issue.path.map(String).join('.'),
            message: issue.message,
          })),
        );
      }
      const { data } = parsed;
      await wrapStorageFailure('importAll', [], () =>
        db.transaction('rw', tables, async () => {
          await Promise.all(tables.map((table) => table.clear()));
          await db.reviewStates.bulkPut(data.reviewStates);
          await db.reviewLogs.bulkPut(data.reviewLogs);
          await db.sessions.bulkPut(data.sessions);
          await db.journal.bulkPut(data.journal);
          await db.assessments.bulkPut(data.assessments);
          await db.customContent.bulkPut(data.customContent);
          if (data.profile !== null) {
            await db.profile.put(data.profile);
          }
        }),
      );
    },
  };
};
