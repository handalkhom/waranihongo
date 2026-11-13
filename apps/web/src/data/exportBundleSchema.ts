import { z } from 'zod';
import { contentIdSchema, customVocabIdSchema, customVocabItemSchema } from '@wara/content/schema';
import type { ExportBundle } from '@wara/core';

const timestampSchema = z.iso.datetime().transform((value) => new Date(value));

const localDateSchema = z.iso.date();

const itemIdSchema = z.union([contentIdSchema, customVocabIdSchema]);

const recordIdSchema = z.string().min(1);

const countSchema = z.int().nonnegative();

const reviewStateSchema = z.strictObject({
  itemId: itemIdSchema,
  stability: z.number().nonnegative(),
  difficulty: z.number().nonnegative(),
  due: timestampSchema,
  lastReview: timestampSchema.nullable(),
  reps: countSchema,
  lapses: countSchema,
  learningSteps: countSchema,
  state: z.enum(['new', 'learning', 'review', 'relearning']),
});

const reviewLogSchema = z.strictObject({
  id: recordIdSchema,
  itemId: itemIdSchema,
  at: timestampSchema,
  rating: z.literal([1, 2, 3, 4]),
  elapsedMs: z.number().nonnegative(),
  confusedWith: itemIdSchema.nullable(),
});

const sessionSchema = z.strictObject({
  id: recordIdSchema,
  date: localDateSchema,
  plannedMin: z.number().nonnegative(),
  actualMin: z.number().nonnegative(),
  activities: z.array(
    z.strictObject({
      kind: z.enum(['review', 'new', 'production']),
      itemIds: z.array(itemIdSchema),
      estimatedSec: z.number().nonnegative(),
      done: z.boolean(),
    }),
  ),
  cursor: countSchema,
  completed: z.boolean(),
});

const journalEntrySchema = z.strictObject({
  id: recordIdSchema,
  date: localDateSchema,
  source: z
    .strictObject({
      anime: z.string().min(1),
      episode: z.int().min(1).nullable(),
    })
    .nullable(),
  sentenceKana: z.string().min(1),
  guess: z.string(),
  context: z.string().nullable(),
  status: z.enum(['draft', 'needs_review', 'corrected']),
  correction: z
    .strictObject({
      sentence: z.string(),
      meaning: z.string(),
      note: z.string().nullable(),
    })
    .nullable(),
  extractedVocabIds: z.array(itemIdSchema),
});

const assessmentSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    id: recordIdSchema,
    date: localDateSchema,
    kind: z.literal('kana-exit'),
    passed: z.boolean(),
    correct: countSchema,
    total: countSchema,
    elapsedMs: z.number().nonnegative(),
    wrong: z.array(itemIdSchema),
  }),
  z.strictObject({
    id: recordIdSchema,
    date: localDateSchema,
    kind: z.literal('jlpt-sim'),
    level: z.enum(['n5', 'n4']),
    score: z.number().min(0).max(1),
  }),
]);

const userProfileSchema = z.strictObject({
  id: z.literal('me'),
  name: z.string(),
  dailyTargetMin: z.int().min(1),
  romajiAid: z.enum(['always', 'on-demand', 'off']),
  theme: z.enum(['system', 'light', 'dark']),
  ttsVoiceUri: z.string().nullable(),
  startDate: localDateSchema,
  weakSeeds: z.array(itemIdSchema),
});

export const exportBundleSchema: z.ZodType<ExportBundle> = z.strictObject({
  format: z.literal('wara-export'),
  version: z.literal(1),
  exportedAt: timestampSchema,
  profile: userProfileSchema.nullable(),
  reviewStates: z.array(reviewStateSchema),
  reviewLogs: z.array(reviewLogSchema),
  sessions: z.array(sessionSchema),
  journal: z.array(journalEntrySchema),
  assessments: z.array(assessmentSchema),
  customContent: z.array(customVocabItemSchema),
});
