import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it, onTestFinished } from 'vitest';
import type { JlptSimAssessment, KanaExitAssessment, Repository } from '@wara/core';
import { WaraDb } from '@/data/db';
import { createDexieRepository } from '@/data/dexieRepository';

const NOW = '2026-11-13T09:00:00.000Z';

const open = (): Repository => {
  const db = new WaraDb(`wara-test-${crypto.randomUUID()}`, {
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
  onTestFinished(() => {
    db.close();
  });
  return createDexieRepository(db, () => new Date(NOW));
};

const kanaExit = (id: string, date: string, overrides: Partial<KanaExitAssessment> = {}): KanaExitAssessment => ({
  id,
  date,
  kind: 'kana-exit',
  passed: false,
  correct: 47,
  total: 50,
  elapsedMs: 412_000,
  wrong: ['kana:kata:ソ', 'kana:kata:ン', 'kana:hira:ぬ'],
  ...overrides,
});

const jlptSim = (id: string, date: string, overrides: Partial<JlptSimAssessment> = {}): JlptSimAssessment => ({
  id,
  date,
  kind: 'jlpt-sim',
  level: 'n5',
  score: 72,
  ...overrides,
});

describe('getAssessments', () => {
  it('should return an empty list when no assessment has been saved', async () => {
    const repository = open();

    expect(await repository.getAssessments()).toEqual([]);
  });

  it('should return a saved kana-exit assessment equal to what was stored when it is the only row', async () => {
    const repository = open();
    const stored = kanaExit('assessment-a', '2026-11-10');
    await repository.saveAssessment(stored);

    expect(await repository.getAssessments()).toEqual([stored]);
  });

  it('should order assessments by date ascending when they were saved out of date order', async () => {
    const repository = open();
    const late = kanaExit('assessment-a', '2026-11-12', { passed: true, correct: 50 });
    const early = kanaExit('assessment-b', '2026-11-01');
    const middle = kanaExit('assessment-c', '2026-11-07');
    await repository.saveAssessment(late);
    await repository.saveAssessment(early);
    await repository.saveAssessment(middle);

    expect(await repository.getAssessments()).toEqual([early, middle, late]);
  });

  it('should order assessments by date across a month boundary when ids sort the other way', async () => {
    const repository = open();
    const december = kanaExit('assessment-1', '2026-12-01');
    const october = kanaExit('assessment-9', '2026-10-31');
    await repository.saveAssessment(december);
    await repository.saveAssessment(october);

    expect(await repository.getAssessments()).toEqual([october, december]);
  });

  it('should order assessments of the same date by id ascending when they were saved in reverse id order', async () => {
    const repository = open();
    const third = kanaExit('assessment-c', '2026-11-10');
    const first = kanaExit('assessment-a', '2026-11-10', { passed: true, correct: 50 });
    const second = jlptSim('assessment-b', '2026-11-10');
    await repository.saveAssessment(third);
    await repository.saveAssessment(first);
    await repository.saveAssessment(second);

    expect(await repository.getAssessments()).toEqual([first, second, third]);
  });

  it('should return both kana-exit and jlpt-sim assessments with their own fields when the kinds are mixed', async () => {
    const repository = open();
    const simN4 = jlptSim('assessment-x', '2026-11-11', { level: 'n4', score: 58 });
    const exit = kanaExit('assessment-y', '2026-11-03', {
      passed: true,
      correct: 50,
      elapsedMs: 600_000,
      wrong: [],
    });
    const simN5 = jlptSim('assessment-z', '2026-11-05', { score: 91 });
    await repository.saveAssessment(simN4);
    await repository.saveAssessment(exit);
    await repository.saveAssessment(simN5);

    expect(await repository.getAssessments()).toEqual([exit, simN5, simN4]);
  });

  it('should return a re-saved assessment once with its new values when saveAssessment reuses an existing id', async () => {
    const repository = open();
    const other = jlptSim('assessment-b', '2026-11-09');
    await repository.saveAssessment(kanaExit('assessment-a', '2026-11-08'));
    await repository.saveAssessment(other);
    const replaced = kanaExit('assessment-a', '2026-11-10', {
      passed: true,
      correct: 50,
      elapsedMs: 300_000,
      wrong: [],
    });
    await repository.saveAssessment(replaced);

    expect(await repository.getAssessments()).toEqual([other, replaced]);
  });
});
