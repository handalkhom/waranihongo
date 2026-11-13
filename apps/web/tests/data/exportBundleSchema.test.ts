import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import type { CustomVocabItem } from '@wara/content/schema';
import type { ExportBundle } from '@wara/core';
import { exportBundleSchema } from '@/data/exportBundleSchema';

const CUSTOM_ID = 'vocab:custom:0f8b3c2e-5a1d-4e7f-9b6a-2c4d8e1f3a5b';

interface LocatedIssue {
  readonly path: ReadonlyArray<PropertyKey>;
  readonly code: string;
  readonly expected: string | null;
}

interface ParseOutcome {
  readonly success: boolean;
  readonly issues: ReadonlyArray<LocatedIssue>;
  readonly paths: ReadonlyArray<ReadonlyArray<PropertyKey>>;
}

const locate = (
  issues: ReadonlyArray<z.core.$ZodIssue>,
  prefix: ReadonlyArray<PropertyKey>,
): ReadonlyArray<LocatedIssue> =>
  issues.flatMap((issue) => {
    const path = [...prefix, ...issue.path];
    const located: LocatedIssue = {
      path,
      code: issue.code,
      expected: issue.code === 'invalid_type' ? issue.expected : null,
    };
    return issue.code === 'invalid_union'
      ? [located, ...issue.errors.flatMap((option) => locate(option, path))]
      : [located];
  });

const parse = (input: unknown): ParseOutcome => {
  const result = exportBundleSchema.safeParse(input);
  const issues = result.success ? [] : locate(result.error.issues, []);
  return { success: result.success, issues, paths: issues.map((issue) => issue.path) };
};

const issuesText = (input: unknown): string => {
  const result = exportBundleSchema.safeParse(input);
  return result.success ? '' : JSON.stringify(result.error.issues);
};

const profileJson = () => ({
  id: 'me',
  name: 'Handal',
  dailyTargetMin: 20,
  romajiAid: 'on-demand',
  theme: 'system',
  ttsVoiceUri: null,
  startDate: '2026-11-01',
  weakSeeds: ['kana:kata:ソ', 'kana:hira:ね'],
});

const reviewedStateJson = () => ({
  itemId: 'kana:hira:ね',
  stability: 3.2,
  difficulty: 5.1,
  due: '2026-11-15T09:00:00.000Z',
  lastReview: '2026-11-12T08:30:00.000Z',
  reps: 3,
  lapses: 1,
  learningSteps: 0,
  state: 'review',
});

const newStateJson = () => ({
  itemId: CUSTOM_ID,
  stability: 0,
  difficulty: 0,
  due: '2026-11-13T09:00:00.000Z',
  lastReview: null,
  reps: 0,
  lapses: 0,
  learningSteps: 0,
  state: 'new',
});

const plainLogJson = () => ({
  id: 'log-1',
  itemId: 'kana:hira:ね',
  at: '2026-11-12T08:30:00.000Z',
  rating: 3,
  elapsedMs: 2100,
  confusedWith: null,
});

const confusedLogJson = () => ({
  id: 'log-2',
  itemId: 'kana:kata:ソ',
  at: '2026-11-12T08:31:00.000Z',
  rating: 1,
  elapsedMs: 5400,
  confusedWith: 'kana:kata:ン',
});

const sessionJson = () => ({
  id: 'session-1',
  date: '2026-11-12',
  plannedMin: 20,
  actualMin: 18.5,
  activities: [
    { kind: 'review', itemIds: ['kana:hira:ね', 'kana:kata:ソ'], estimatedSec: 16, done: true },
    { kind: 'new', itemIds: ['vocab:other:ともだち'], estimatedSec: 30, done: false },
  ],
  cursor: 1,
  completed: false,
});

const journalJson = () => ({
  id: 'journal-1',
  date: '2026-11-12',
  source: { anime: 'Frieren', episode: 3 },
  sentenceKana: 'ともだちになろう',
  guess: 'ayo jadi teman',
  context: 'di akhir episode',
  status: 'corrected',
  correction: { sentence: 'ともだちになろう', meaning: 'mari berteman', note: null },
  extractedVocabIds: ['vocab:other:ともだち', CUSTOM_ID],
});

const kanaExitJson = () => ({
  id: 'assessment-1',
  date: '2026-11-10',
  kind: 'kana-exit',
  passed: false,
  correct: 48,
  total: 50,
  elapsedMs: 290000,
  wrong: ['kana:kata:ソ', 'kana:kata:ン'],
});

const jlptSimJson = () => ({
  id: 'assessment-2',
  date: '2026-11-11',
  kind: 'jlpt-sim',
  level: 'n5',
  score: 0.72,
});

const customItemJson = () => ({
  type: 'vocab',
  source: 'custom',
  id: CUSTOM_ID,
  level: 'custom',
  phase: 1,
  tags: ['anime'],
  data: { word: '頑張る', reading: 'がんばる', meaning: 'berusaha keras' },
});

const validBundleJson = () => ({
  format: 'wara-export',
  version: 1,
  exportedAt: '2026-11-13T09:00:00.000Z',
  profile: profileJson(),
  reviewStates: [reviewedStateJson(), newStateJson()],
  reviewLogs: [plainLogJson(), confusedLogJson()],
  sessions: [sessionJson()],
  journal: [journalJson()],
  assessments: [kanaExitJson(), jlptSimJson()],
  customContent: [customItemJson()],
});

const bundleWith = (overrides: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> => ({
  ...validBundleJson(),
  ...overrides,
});

const bundleWithout = (key: string): Readonly<Record<string, unknown>> =>
  Object.fromEntries(Object.entries(validBundleJson()).filter(([name]) => name !== key));

const expectedCustomItem = (): CustomVocabItem => ({
  type: 'vocab',
  source: 'custom',
  id: CUSTOM_ID,
  level: 'custom',
  phase: 1,
  tags: ['anime'],
  data: { word: '頑張る', reading: 'がんばる', meaning: 'berusaha keras' },
});

const expectedBundle = (): ExportBundle => ({
  format: 'wara-export',
  version: 1,
  exportedAt: new Date('2026-11-13T09:00:00.000Z'),
  profile: {
    id: 'me',
    name: 'Handal',
    dailyTargetMin: 20,
    romajiAid: 'on-demand',
    theme: 'system',
    ttsVoiceUri: null,
    startDate: '2026-11-01',
    weakSeeds: ['kana:kata:ソ', 'kana:hira:ね'],
  },
  reviewStates: [
    {
      itemId: 'kana:hira:ね',
      stability: 3.2,
      difficulty: 5.1,
      due: new Date('2026-11-15T09:00:00.000Z'),
      lastReview: new Date('2026-11-12T08:30:00.000Z'),
      reps: 3,
      lapses: 1,
      learningSteps: 0,
      state: 'review',
    },
    {
      itemId: CUSTOM_ID,
      stability: 0,
      difficulty: 0,
      due: new Date('2026-11-13T09:00:00.000Z'),
      lastReview: null,
      reps: 0,
      lapses: 0,
      learningSteps: 0,
      state: 'new',
    },
  ],
  reviewLogs: [
    {
      id: 'log-1',
      itemId: 'kana:hira:ね',
      at: new Date('2026-11-12T08:30:00.000Z'),
      rating: 3,
      elapsedMs: 2100,
      confusedWith: null,
    },
    {
      id: 'log-2',
      itemId: 'kana:kata:ソ',
      at: new Date('2026-11-12T08:31:00.000Z'),
      rating: 1,
      elapsedMs: 5400,
      confusedWith: 'kana:kata:ン',
    },
  ],
  sessions: [
    {
      id: 'session-1',
      date: '2026-11-12',
      plannedMin: 20,
      actualMin: 18.5,
      activities: [
        { kind: 'review', itemIds: ['kana:hira:ね', 'kana:kata:ソ'], estimatedSec: 16, done: true },
        { kind: 'new', itemIds: ['vocab:other:ともだち'], estimatedSec: 30, done: false },
      ],
      cursor: 1,
      completed: false,
    },
  ],
  journal: [
    {
      id: 'journal-1',
      date: '2026-11-12',
      source: { anime: 'Frieren', episode: 3 },
      sentenceKana: 'ともだちになろう',
      guess: 'ayo jadi teman',
      context: 'di akhir episode',
      status: 'corrected',
      correction: { sentence: 'ともだちになろう', meaning: 'mari berteman', note: null },
      extractedVocabIds: ['vocab:other:ともだち', CUSTOM_ID],
    },
  ],
  assessments: [
    {
      id: 'assessment-1',
      date: '2026-11-10',
      kind: 'kana-exit',
      passed: false,
      correct: 48,
      total: 50,
      elapsedMs: 290000,
      wrong: ['kana:kata:ソ', 'kana:kata:ン'],
    },
    { id: 'assessment-2', date: '2026-11-11', kind: 'jlpt-sim', level: 'n5', score: 0.72 },
  ],
  customContent: [expectedCustomItem()],
});

describe('exportBundleSchema with a valid bundle', () => {
  it('should convert exactly the timestamp fields to Dates and keep local dates as strings when the bundle is valid', () => {
    const result = exportBundleSchema.safeParse(validBundleJson());

    expect(result.success).toBe(true);
    expect(result.data).toEqual(expectedBundle());
  });

  it('should return an equal bundle when an exported bundle goes through JSON and back', () => {
    const result = exportBundleSchema.safeParse(JSON.parse(JSON.stringify(expectedBundle())));

    expect(result.success).toBe(true);
    expect(result.data).toEqual(expectedBundle());
  });

  it('should accept a bundle with no profile and every collection empty', () => {
    const result = exportBundleSchema.safeParse({
      format: 'wara-export',
      version: 1,
      exportedAt: '2026-11-13T09:00:00.000Z',
      profile: null,
      reviewStates: [],
      reviewLogs: [],
      sessions: [],
      journal: [],
      assessments: [],
      customContent: [],
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      format: 'wara-export',
      version: 1,
      exportedAt: new Date('2026-11-13T09:00:00.000Z'),
      profile: null,
      reviewStates: [],
      reviewLogs: [],
      sessions: [],
      journal: [],
      assessments: [],
      customContent: [],
    });
  });

  it('should accept every numeric field at its inclusive lower or upper bound', () => {
    const outcome = parse(
      bundleWith({
        profile: { ...profileJson(), dailyTargetMin: 1, ttsVoiceUri: 'urn:voice:ja-JP', weakSeeds: [] },
        reviewLogs: [{ ...plainLogJson(), rating: 4, elapsedMs: 0 }],
        sessions: [
          {
            ...sessionJson(),
            plannedMin: 0,
            actualMin: 0,
            cursor: 0,
            completed: true,
            activities: [{ kind: 'production', itemIds: [], estimatedSec: 0, done: true }],
          },
        ],
        journal: [
          { ...journalJson(), source: { anime: 'Frieren', episode: 1 }, context: null, guess: '', status: 'draft', correction: null },
          { ...journalJson(), id: 'journal-2', source: null, status: 'needs_review', correction: null, extractedVocabIds: [] },
        ],
        assessments: [
          { ...kanaExitJson(), passed: true, correct: 0, total: 0, elapsedMs: 0, wrong: [] },
          { ...jlptSimJson(), level: 'n4', score: 1 },
          { ...jlptSimJson(), id: 'assessment-3', score: 0 },
        ],
      }),
    );

    expect(outcome.issues).toEqual([]);
    expect(outcome.success).toBe(true);
  });
});

interface RejectionCase {
  readonly name: string;
  readonly input: () => unknown;
  readonly path: ReadonlyArray<PropertyKey>;
}

const rejectionCases: ReadonlyArray<RejectionCase> = [
  {
    name: 'should reject a bundle whose format is not wara-export',
    input: () => bundleWith({ format: 'wara-backup' }),
    path: ['format'],
  },
  {
    name: 'should reject a bundle whose version is 2',
    input: () => bundleWith({ version: 2 }),
    path: ['version'],
  },
  {
    name: 'should reject an exportedAt written as 13/11/2026',
    input: () => bundleWith({ exportedAt: '13/11/2026' }),
    path: ['exportedAt'],
  },
  {
    name: 'should reject an exportedAt written as epoch milliseconds',
    input: () => bundleWith({ exportedAt: 1794560400000 }),
    path: ['exportedAt'],
  },
  {
    name: 'should reject an exportedAt carrying a +07:00 offset instead of Z',
    input: () => bundleWith({ exportedAt: '2026-11-13T16:00:00.000+07:00' }),
    path: ['exportedAt'],
  },
  {
    name: 'should reject a review state whose due is 13/11/2026',
    input: () => bundleWith({ reviewStates: [{ ...reviewedStateJson(), due: '13/11/2026' }] }),
    path: ['reviewStates', 0, 'due'],
  },
  {
    name: 'should reject a review state whose lastReview is a local date without time',
    input: () => bundleWith({ reviewStates: [{ ...reviewedStateJson(), lastReview: '2026-11-12' }] }),
    path: ['reviewStates', 0, 'lastReview'],
  },
  {
    name: 'should reject a review state whose state is suspended',
    input: () => bundleWith({ reviewStates: [{ ...reviewedStateJson(), state: 'suspended' }] }),
    path: ['reviewStates', 0, 'state'],
  },
  {
    name: 'should reject a review state whose itemId is romaji ne',
    input: () => bundleWith({ reviewStates: [{ ...reviewedStateJson(), itemId: 'ne' }] }),
    path: ['reviewStates', 0, 'itemId'],
  },
  {
    name: 'should reject a review state whose itemId is in NFD form',
    input: () => bundleWith({ reviewStates: [{ ...reviewedStateJson(), itemId: 'kana:hira:ぱ'.normalize('NFD') }] }),
    path: ['reviewStates', 0, 'itemId'],
  },
  {
    name: 'should reject a review state whose reps is negative',
    input: () => bundleWith({ reviewStates: [{ ...reviewedStateJson(), reps: -1 }] }),
    path: ['reviewStates', 0, 'reps'],
  },
  {
    name: 'should reject a review state whose reps is fractional',
    input: () => bundleWith({ reviewStates: [{ ...reviewedStateJson(), reps: 1.5 }] }),
    path: ['reviewStates', 0, 'reps'],
  },
  {
    name: 'should reject a review state whose lapses is negative',
    input: () => bundleWith({ reviewStates: [{ ...reviewedStateJson(), lapses: -1 }] }),
    path: ['reviewStates', 0, 'lapses'],
  },
  {
    name: 'should reject a review state whose learningSteps is fractional',
    input: () => bundleWith({ reviewStates: [{ ...reviewedStateJson(), learningSteps: 0.5 }] }),
    path: ['reviewStates', 0, 'learningSteps'],
  },
  {
    name: 'should reject a review state whose stability is negative',
    input: () => bundleWith({ reviewStates: [{ ...reviewedStateJson(), stability: -0.1 }] }),
    path: ['reviewStates', 0, 'stability'],
  },
  {
    name: 'should reject a review state whose difficulty is negative',
    input: () => bundleWith({ reviewStates: [{ ...reviewedStateJson(), difficulty: -0.1 }] }),
    path: ['reviewStates', 0, 'difficulty'],
  },
  {
    name: 'should reject a review log whose rating is 0',
    input: () => bundleWith({ reviewLogs: [{ ...plainLogJson(), rating: 0 }] }),
    path: ['reviewLogs', 0, 'rating'],
  },
  {
    name: 'should reject a review log whose rating is 5',
    input: () => bundleWith({ reviewLogs: [{ ...plainLogJson(), rating: 5 }] }),
    path: ['reviewLogs', 0, 'rating'],
  },
  {
    name: 'should reject a review log whose at is epoch milliseconds',
    input: () => bundleWith({ reviewLogs: [{ ...plainLogJson(), at: 1794560400000 }] }),
    path: ['reviewLogs', 0, 'at'],
  },
  {
    name: 'should reject a review log whose confusedWith is romaji ne',
    input: () => bundleWith({ reviewLogs: [plainLogJson(), { ...confusedLogJson(), confusedWith: 'ne' }] }),
    path: ['reviewLogs', 1, 'confusedWith'],
  },
  {
    name: 'should reject a review log whose elapsedMs is negative',
    input: () => bundleWith({ reviewLogs: [{ ...plainLogJson(), elapsedMs: -1 }] }),
    path: ['reviewLogs', 0, 'elapsedMs'],
  },
  {
    name: 'should reject a review log whose id is empty',
    input: () => bundleWith({ reviewLogs: [{ ...plainLogJson(), id: '' }] }),
    path: ['reviewLogs', 0, 'id'],
  },
  {
    name: 'should reject a session whose date is 2026-11-1',
    input: () => bundleWith({ sessions: [{ ...sessionJson(), date: '2026-11-1' }] }),
    path: ['sessions', 0, 'date'],
  },
  {
    name: 'should reject a session whose plannedMin is negative',
    input: () => bundleWith({ sessions: [{ ...sessionJson(), plannedMin: -1 }] }),
    path: ['sessions', 0, 'plannedMin'],
  },
  {
    name: 'should reject a session whose cursor is fractional',
    input: () => bundleWith({ sessions: [{ ...sessionJson(), cursor: 1.5 }] }),
    path: ['sessions', 0, 'cursor'],
  },
  {
    name: 'should reject a session whose completed is the string yes',
    input: () => bundleWith({ sessions: [{ ...sessionJson(), completed: 'yes' }] }),
    path: ['sessions', 0, 'completed'],
  },
  {
    name: 'should reject a session activity whose kind is quiz',
    input: () =>
      bundleWith({
        sessions: [{ ...sessionJson(), activities: [{ kind: 'quiz', itemIds: [], estimatedSec: 0, done: false }] }],
      }),
    path: ['sessions', 0, 'activities', 0, 'kind'],
  },
  {
    name: 'should reject a session activity whose estimatedSec is negative',
    input: () =>
      bundleWith({
        sessions: [{ ...sessionJson(), activities: [{ kind: 'review', itemIds: [], estimatedSec: -1, done: false }] }],
      }),
    path: ['sessions', 0, 'activities', 0, 'estimatedSec'],
  },
  {
    name: 'should reject a session activity whose itemIds hold romaji ne',
    input: () =>
      bundleWith({
        sessions: [{ ...sessionJson(), activities: [{ kind: 'review', itemIds: ['ne'], estimatedSec: 8, done: false }] }],
      }),
    path: ['sessions', 0, 'activities', 0, 'itemIds', 0],
  },
  {
    name: 'should reject a journal entry whose date is 2026-11-1',
    input: () => bundleWith({ journal: [{ ...journalJson(), date: '2026-11-1' }] }),
    path: ['journal', 0, 'date'],
  },
  {
    name: 'should reject a journal entry whose source episode is 0',
    input: () => bundleWith({ journal: [{ ...journalJson(), source: { anime: 'Frieren', episode: 0 } }] }),
    path: ['journal', 0, 'source', 'episode'],
  },
  {
    name: 'should reject a journal entry whose source anime is empty',
    input: () => bundleWith({ journal: [{ ...journalJson(), source: { anime: '', episode: null } }] }),
    path: ['journal', 0, 'source', 'anime'],
  },
  {
    name: 'should reject a journal entry whose sentenceKana is empty',
    input: () => bundleWith({ journal: [{ ...journalJson(), sentenceKana: '' }] }),
    path: ['journal', 0, 'sentenceKana'],
  },
  {
    name: 'should reject a journal entry whose status is published',
    input: () => bundleWith({ journal: [{ ...journalJson(), status: 'published' }] }),
    path: ['journal', 0, 'status'],
  },
  {
    name: 'should reject a journal entry whose extractedVocabIds hold romaji ne',
    input: () => bundleWith({ journal: [{ ...journalJson(), extractedVocabIds: ['ne'] }] }),
    path: ['journal', 0, 'extractedVocabIds', 0],
  },
  {
    name: 'should reject a kana-exit assessment whose correct is fractional',
    input: () => bundleWith({ assessments: [{ ...kanaExitJson(), correct: 48.5 }] }),
    path: ['assessments', 0, 'correct'],
  },
  {
    name: 'should reject a kana-exit assessment whose wrong ids hold romaji ne',
    input: () => bundleWith({ assessments: [{ ...kanaExitJson(), wrong: ['ne'] }] }),
    path: ['assessments', 0, 'wrong', 0],
  },
  {
    name: 'should reject a jlpt-sim assessment whose score is 1.2',
    input: () => bundleWith({ assessments: [kanaExitJson(), { ...jlptSimJson(), score: 1.2 }] }),
    path: ['assessments', 1, 'score'],
  },
  {
    name: 'should reject a jlpt-sim assessment whose level is n3',
    input: () => bundleWith({ assessments: [{ ...jlptSimJson(), level: 'n3' }] }),
    path: ['assessments', 0, 'level'],
  },
  {
    name: 'should reject an assessment whose date is 2026-11-1',
    input: () => bundleWith({ assessments: [{ ...jlptSimJson(), date: '2026-11-1' }] }),
    path: ['assessments', 0, 'date'],
  },
  {
    name: 'should reject a profile whose id is you',
    input: () => bundleWith({ profile: { ...profileJson(), id: 'you' } }),
    path: ['profile', 'id'],
  },
  {
    name: 'should reject a profile whose romajiAid is sometimes',
    input: () => bundleWith({ profile: { ...profileJson(), romajiAid: 'sometimes' } }),
    path: ['profile', 'romajiAid'],
  },
  {
    name: 'should reject a profile whose theme is sepia',
    input: () => bundleWith({ profile: { ...profileJson(), theme: 'sepia' } }),
    path: ['profile', 'theme'],
  },
  {
    name: 'should reject a profile whose dailyTargetMin is 0',
    input: () => bundleWith({ profile: { ...profileJson(), dailyTargetMin: 0 } }),
    path: ['profile', 'dailyTargetMin'],
  },
  {
    name: 'should reject a profile whose ttsVoiceUri is a number',
    input: () => bundleWith({ profile: { ...profileJson(), ttsVoiceUri: 5 } }),
    path: ['profile', 'ttsVoiceUri'],
  },
  {
    name: 'should reject a profile whose startDate is 2026-11-1',
    input: () => bundleWith({ profile: { ...profileJson(), startDate: '2026-11-1' } }),
    path: ['profile', 'startDate'],
  },
  {
    name: 'should reject a profile whose weakSeeds hold romaji ne',
    input: () => bundleWith({ profile: { ...profileJson(), weakSeeds: ['ne'] } }),
    path: ['profile', 'weakSeeds', 0],
  },
  {
    name: 'should reject custom content whose source is content',
    input: () => bundleWith({ customContent: [{ ...customItemJson(), source: 'content' }] }),
    path: ['customContent', 0, 'source'],
  },
  {
    name: 'should reject a bundle missing reviewLogs',
    input: () => bundleWithout('reviewLogs'),
    path: ['reviewLogs'],
  },
];

describe('exportBundleSchema rejecting a bad field', () => {
  for (const { name, input, path } of rejectionCases) {
    it(name, () => {
      const outcome = parse(input());

      expect(outcome.success).toBe(false);
      expect(outcome.paths).toContainEqual(path);
    });
  }
});

describe('exportBundleSchema rejecting unknown keys', () => {
  it('should reject an unknown top-level key with unrecognized_keys at the root', () => {
    const outcome = parse(bundleWith({ comment: 'dari laptop lama' }));

    expect(outcome.success).toBe(false);
    expect(outcome.issues).toContainEqual({ path: [], code: 'unrecognized_keys', expected: null });
  });

  it('should reject an unknown key inside a review state with unrecognized_keys at that state', () => {
    const outcome = parse(bundleWith({ reviewStates: [{ ...reviewedStateJson(), suspended: true }] }));

    expect(outcome.success).toBe(false);
    expect(outcome.issues).toContainEqual({ path: ['reviewStates', 0], code: 'unrecognized_keys', expected: null });
  });

  it('should reject an unknown key inside a journal correction with unrecognized_keys at that correction', () => {
    const outcome = parse(
      bundleWith({
        journal: [
          {
            ...journalJson(),
            correction: { sentence: 'ともだちになろう', meaning: 'mari berteman', note: null, tutor: 'Sensei' },
          },
        ],
      }),
    );

    expect(outcome.success).toBe(false);
    expect(outcome.issues).toContainEqual({
      path: ['journal', 0, 'correction'],
      code: 'unrecognized_keys',
      expected: null,
    });
  });
});

describe('exportBundleSchema rejecting a non-object', () => {
  const nonObjects: ReadonlyArray<{ readonly name: string; readonly input: unknown }> = [
    { name: 'should reject null as an invalid type expecting an object at the root', input: null },
    { name: 'should reject an array as an invalid type expecting an object at the root', input: [] },
    { name: 'should reject a string as an invalid type expecting an object at the root', input: 'x' },
  ];

  for (const { name, input } of nonObjects) {
    it(name, () => {
      const outcome = parse(input);

      expect(outcome.success).toBe(false);
      expect(outcome.issues).toContainEqual({ path: [], code: 'invalid_type', expected: 'object' });
    });
  }
});

describe('exportBundleSchema privacy', () => {
  const secretSentence = 'あのひとがすきだとおもう';

  it('should keep the sentenceKana out of the issues when a journal entry is rejected for its status', () => {
    const input = bundleWith({
      journal: [{ ...journalJson(), sentenceKana: secretSentence, status: 'published' }],
    });

    expect(parse(input).paths).toContainEqual(['journal', 0, 'status']);
    expect(issuesText(input)).not.toContain(secretSentence);
  });

  it('should keep the sentenceKana out of the issues when a journal entry is rejected for an unknown key', () => {
    const input = bundleWith({
      journal: [{ ...journalJson(), sentenceKana: secretSentence, mood: 'senang' }],
    });

    expect(parse(input).issues).toContainEqual({ path: ['journal', 0], code: 'unrecognized_keys', expected: null });
    expect(issuesText(input)).not.toContain(secretSentence);
  });
});
