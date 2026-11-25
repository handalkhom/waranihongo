import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import Dexie from 'dexie';
import { afterEach, assert, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { contentBundle } from '@wara/content';
import type { KanaItem, VocabItem } from '@wara/content/schema';
import {
  RATING,
  kanaExitWords,
  romanize,
  type Assessment,
  type Repository,
  type ReviewLog,
  type ReviewState,
  type UserProfile,
} from '@wara/core';
import type { WaraDb } from '@/data/db';
import { renderApp } from '../../renderApp';

const WAIT = { timeout: 4000 };
const FULL_RUN = { timeout: 60_000 };
const DAY_MS = 24 * 60 * 60 * 1000;

const NOW = new Date(2026, 10, 24, 9, 0, 0);
const TODAY = '2026-11-24';
const PATH = '/tes/kana-exit';
const PINNED_RANDOM = 0.999999;
const WORD_COUNT = 50;
const WRONG_ANSWER = 'zzz';

const KANA: ReadonlyArray<KanaItem> = contentBundle.items.flatMap((item) => (item.type === 'kana' ? [item] : []));

const KANA_DATA = KANA.map((item) => item.data);

const DRILLABLE_KANA_IDS: ReadonlyArray<string> = KANA.filter(
  (item) => item.data.romaji !== '' && item.supersededBy === undefined,
).map((item) => item.id);

const WORDS: ReadonlyArray<VocabItem> = kanaExitWords({ items: contentBundle.items, rng: () => PINNED_RANDOM });

const PROFILE: UserProfile = {
  id: 'me',
  name: 'Handal',
  dailyTargetMin: 20,
  romajiAid: 'on-demand',
  theme: 'system',
  ttsVoiceUri: null,
  startDate: '2026-11-01',
  weakSeeds: [],
};

const reviewed = (itemId: string): ReviewState => ({
  itemId,
  stability: 12,
  difficulty: 5,
  due: new Date(NOW.getTime() + 10 * DAY_MS),
  lastReview: new Date(NOW.getTime() - 2 * DAY_MS),
  reps: 3,
  lapses: 0,
  learningSteps: 0,
  state: 'review',
});

const seedOpen = async (repository: Repository): Promise<void> => {
  await repository.saveProfile(PROFILE);
  await repository.commitReview(DRILLABLE_KANA_IDS.map(reviewed), []);
};

const wordAt = (n: number): VocabItem => {
  const word = WORDS[n - 1];
  assert.isDefined(word, `kata ke-${String(n)} tidak ada`);
  return word;
};

const romajiOf = (word: VocabItem): string => romanize({ reading: word.data.reading, kana: KANA_DATA });

const pinRandom = (): void => {
  const spy = vi.spyOn(Math, 'random').mockReturnValue(PINNED_RANDOM);
  onTestFinished(() => {
    spy.mockRestore();
  });
};

const start = (beforeRender: (db: WaraDb) => void = () => undefined): ReturnType<typeof renderApp> => {
  pinRandom();
  return renderApp({ path: PATH, seed: seedOpen, beforeRender });
};

const advance = (ms: number): void => {
  vi.setSystemTime(Date.now() + ms);
};

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\/]/gu, '\\$&');

const phrase = (text: string): RegExp =>
  new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(text).replace(/ /gu, '\\s+')}($|[^\\p{L}\\p{N}])`, 'u');

const phraseShown = (text: string): boolean =>
  screen.queryAllByText((_content, element) => element !== null && phrase(text).test(element.textContent)).length > 0;

const waitPhrases = (texts: ReadonlyArray<string>): Promise<void> =>
  waitFor(() => {
    for (const text of texts) {
      assert.isTrue(phraseShown(text), `"${text}" tidak ditampilkan`);
    }
  }, WAIT);

const present = (query: () => HTMLElement | null, message: string): Promise<HTMLElement> =>
  waitFor(() => {
    const element = query();
    assert.isNotNull(element, message);
    return element;
  }, WAIT);

const button = (name: string): Promise<HTMLElement> =>
  present(() => screen.queryByRole('button', { name }), `tombol "${name}" tidak ditemukan`);

const link = (name: string): Promise<HTMLElement> =>
  present(() => screen.queryByRole('link', { name }), `tautan "${name}" tidak ditemukan`);

const headingShown = (name: string, level = 1): Promise<HTMLElement> =>
  present(() => screen.queryByRole('heading', { level, name }), `judul "${name}" tidak ditampilkan`);

const showsWord = (element: Element, text: string): boolean =>
  element.textContent.replace(/\s/gu, '') === text && element.closest('[lang="ja"]') !== null;

const wordElements = (text: string, container: HTMLElement = document.body): ReadonlyArray<HTMLElement> =>
  within(container).queryAllByText((_content, element) => element !== null && showsWord(element, text));

const wordShown = (word: VocabItem): Promise<void> =>
  waitFor(() => {
    assert.isNotEmpty(wordElements(word.data.word), `kata ${word.data.word} tidak ditampilkan dengan lang="ja"`);
  }, WAIT);

const counter = (n: number): string => `Kata ${String(n)} dari ${String(WORD_COUNT)}`;

const counterShown = (n: number): Promise<void> => waitPhrases([counter(n)]);

const romajiInput = async (): Promise<HTMLInputElement> => {
  const input = await present(
    () => screen.queryByLabelText('Romaji kata tadi'),
    'input berlabel "Romaji kata tadi" tidak ditemukan',
  );
  assert.instanceOf(input, HTMLInputElement);
  return input;
};

const submitButton = async (): Promise<HTMLButtonElement> => {
  const element = await button('Kirim');
  assert.instanceOf(element, HTMLButtonElement);
  return element;
};

const answer = async (n: number, text: string, displayMs: number, typingMs = 0): Promise<void> => {
  await counterShown(n);
  await wordShown(wordAt(n));
  advance(displayMs);
  fireEvent.click(await button('Siap'));
  fireEvent.change(await romajiInput(), { target: { value: text } });
  advance(typingMs);
  fireEvent.click(await submitButton());
  if (n < WORD_COUNT) {
    await counterShown(n + 1);
  }
};

const runAll = async (displayMs: number, wrongAt: ReadonlyArray<number> = []): Promise<void> => {
  for (const [index, word] of WORDS.entries()) {
    const n = index + 1;
    await answer(n, wrongAt.includes(n) ? WRONG_ANSWER : romajiOf(word), displayMs);
  }
};

const logsOf = (db: WaraDb, itemId: string): Promise<ReadonlyArray<ReviewLog>> =>
  db.reviewLogs.where('itemId').equals(itemId).toArray();

const loggedOnce = (db: WaraDb, itemId: string): Promise<ReviewLog> =>
  waitFor(async () => {
    const logs = await logsOf(db, itemId);
    expect(logs).toHaveLength(1);
    const [log] = logs;
    assert.isDefined(log, `log ${itemId} tidak ditulis`);
    return log;
  }, WAIT);

const onlyAssessment = (repository: Repository): Promise<Assessment> =>
  waitFor(async () => {
    const saved = await repository.getAssessments();
    expect(saved).toHaveLength(1);
    const [assessment] = saved;
    assert.isDefined(assessment, 'asesmen tidak disimpan');
    return assessment;
  }, WAIT);

const noFeedbackShown = (): void => {
  expect(phraseShown('Benar')).toBe(false);
  expect(phraseShown('Belum tepat')).toBe(false);
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('TestPage kana-exit — showing a word', () => {
  it('should show "Kata 1 dari 50", "Waktu tampil 0:00 / 2:00", the first drawn word in lang="ja", a "Siap" button and a "Keluar" link to / when the test opens', async () => {
    await start();

    await counterShown(1);
    await waitPhrases(['Waktu tampil 0:00 / 2:00']);
    await wordShown(wordAt(1));
    expect(wordElements(wordAt(2).data.word)).toEqual([]);
    expect(await button('Siap')).toBeInstanceOf(HTMLButtonElement);
    expect((await link('Keluar')).getAttribute('href')).toBe('/');
    expect(screen.queryByLabelText('Romaji kata tadi')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Navigasi utama' })).toBeNull();
  });

  it('should hide the word and show the "Romaji kata tadi" input with "Kirim" disabled until something is typed when "Siap" is pressed', async () => {
    await start();
    await wordShown(wordAt(1));

    fireEvent.click(await button('Siap'));

    const input = await romajiInput();
    expect(input.value).toBe('');
    expect(wordElements(wordAt(1).data.word)).toEqual([]);
    expect(document.body.textContent).not.toContain(wordAt(1).data.word);
    expect(screen.queryByRole('button', { name: 'Siap' })).toBeNull();
    await counterShown(1);
    expect((await submitButton()).disabled).toBe(true);

    fireEvent.change(input, { target: { value: 'a' } });

    expect((await submitButton()).disabled).toBe(false);
  });
});

describe('TestPage kana-exit — answering', () => {
  it('should move to "Kata 2 dari 50" with the second word, show no feedback, and log word 1 with elapsedMs 1500 when it was shown 1500 ms and typed for 4000 ms', async () => {
    const { db, repository } = await start();
    const first = wordAt(1);

    await answer(1, romajiOf(first), 1500, 4000);

    await wordShown(wordAt(2));
    expect(wordElements(first.data.word)).toEqual([]);
    noFeedbackShown();
    await waitPhrases(['Waktu tampil 0:01 / 2:00']);
    const log = await loggedOnce(db, first.id);
    expect(log.elapsedMs).toBe(1500);
    expect(log.rating).toBeGreaterThan(RATING.again);
    const states = await repository.getReviewStates([first.id]);
    expect(states.map((state) => state.itemId)).toEqual([first.id]);
  });

  it('should still move to "Kata 2 dari 50" without feedback and write an Again log and a state for word 1 when its answer is wrong', async () => {
    const { db, repository } = await start();
    const first = wordAt(1);

    await answer(1, WRONG_ANSWER, 1000);

    await wordShown(wordAt(2));
    noFeedbackShown();
    const log = await loggedOnce(db, first.id);
    expect(log.rating).toBe(RATING.again);
    expect(log.elapsedMs).toBe(1000);
    const states = await repository.getReviewStates([first.id]);
    expect(states.map((state) => state.itemId)).toEqual([first.id]);
    expect(await repository.getAssessments()).toEqual([]);
  });
});

describe('TestPage kana-exit — result', () => {
  it('should show "Lulus", "50 dari 50 benar, waktu tampil 0:50." and "Fase 1 terbuka." and save a passed assessment with elapsedMs 50000 when all 50 words are right at 1000 ms each', FULL_RUN, async () => {
    const { db, repository } = await start();

    await runAll(1000);

    await headingShown('Lulus');
    await waitPhrases(['50 dari 50 benar, waktu tampil 0:50.', 'Fase 1 terbuka.']);
    expect(screen.queryByRole('heading', { level: 1, name: 'Belum lulus' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Kata yang salah' })).toBeNull();
    expect(phraseShown('Waktu tampil melebihi 2:00.')).toBe(false);
    expect((await link('Kembali ke Beranda')).getAttribute('href')).toBe('/');
    const saved = await onlyAssessment(repository);
    expect(saved).toEqual({
      id: saved.id,
      kind: 'kana-exit',
      passed: true,
      correct: 50,
      total: 50,
      elapsedMs: 50_000,
      wrong: [],
      date: TODAY,
    });
    expect(saved.id).not.toBe('');
    expect(await db.reviewLogs.count()).toBe(WORD_COUNT);
  });

  it('should run to word 50 and show "Belum lulus", "49 dari 50 benar" and word 3 with its romaji under "Kata yang salah" when word 3 is answered wrong', FULL_RUN, async () => {
    const { db, repository } = await start();
    const third = wordAt(3);

    await runAll(1000, [3]);

    await headingShown('Belum lulus');
    await waitPhrases(['49 dari 50 benar, waktu tampil 0:50.']);
    expect(phraseShown('Fase 1 terbuka.')).toBe(false);
    expect(phraseShown('Waktu tampil melebihi 2:00.')).toBe(false);
    await headingShown('Kata yang salah', 2);
    const list = screen.getAllByRole('list').find((candidate) => wordElements(third.data.word, candidate).length > 0);
    assert.isDefined(list, `daftar kata yang salah tidak memuat ${third.data.word}`);
    const entries = within(list).getAllByRole('listitem');
    expect(entries).toHaveLength(1);
    const [entry] = entries;
    assert.isDefined(entry, 'butir kata yang salah tidak ada');
    expect(wordElements(third.data.word, entry)).not.toEqual([]);
    expect(phrase(romajiOf(third)).test(entry.textContent)).toBe(true);
    expect((await link('Kembali ke Beranda')).getAttribute('href')).toBe('/');
    const saved = await onlyAssessment(repository);
    expect(saved).toEqual({
      id: saved.id,
      kind: 'kana-exit',
      passed: false,
      correct: 49,
      total: 50,
      elapsedMs: 50_000,
      wrong: [third.id],
      date: TODAY,
    });
    expect(await db.reviewLogs.count()).toBe(WORD_COUNT);
    expect((await logsOf(db, third.id))[0]?.rating).toBe(RATING.again);
  });

  it('should show "Belum lulus", "50 dari 50 benar, waktu tampil 2:05." and "Waktu tampil melebihi 2:00." without a wrong-word list when all 50 words are right at 2500 ms each', FULL_RUN, async () => {
    const { repository } = await start();

    await runAll(2500);

    await headingShown('Belum lulus');
    await waitPhrases(['50 dari 50 benar, waktu tampil 2:05.', 'Waktu tampil melebihi 2:00.']);
    expect(screen.queryByRole('heading', { name: 'Kata yang salah' })).toBeNull();
    expect(phraseShown('Fase 1 terbuka.')).toBe(false);
    expect((await link('Kembali ke Beranda')).getAttribute('href')).toBe('/');
    const saved = await onlyAssessment(repository);
    expect(saved).toEqual({
      id: saved.id,
      kind: 'kana-exit',
      passed: false,
      correct: 50,
      total: 50,
      elapsedMs: 125_000,
      wrong: [],
      date: TODAY,
    });
  });
});

describe('TestPage kana-exit — leaving', () => {
  it('should return to Beranda, keep the two committed review logs and save no assessment when "Keluar" is pressed after two answers', async () => {
    const { db, repository, router } = await start();
    await answer(1, romajiOf(wordAt(1)), 1000);
    await answer(2, romajiOf(wordAt(2)), 1000);
    await wordShown(wordAt(3));

    fireEvent.click(await link('Keluar'));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    }, WAIT);
    await waitFor(async () => {
      expect(await db.reviewLogs.count()).toBe(2);
    }, WAIT);
    expect(await logsOf(db, wordAt(1).id)).toHaveLength(1);
    expect(await logsOf(db, wordAt(2).id)).toHaveLength(1);
    expect(await repository.getAssessments()).toEqual([]);
  });
});

describe('TestPage kana-exit — failures', () => {
  it('should show "Jawaban gagal disimpan. Coba kirim lagi.", stay on "Kata 1 dari 50" with the input and write nothing when the review commit fails, then move on when "Kirim" is retried', async () => {
    const failLog = (): void => {
      throw new Dexie.UnknownError('injected');
    };
    const { db, repository } = await start((opened) => {
      opened.reviewLogs.hook('creating', failLog);
    });
    const first = wordAt(1);
    await counterShown(1);
    await wordShown(first);
    advance(1200);
    fireEvent.click(await button('Siap'));
    fireEvent.change(await romajiInput(), { target: { value: romajiOf(first) } });
    fireEvent.click(await submitButton());

    const alert = await present(() => screen.queryByRole('alert'), 'tidak ada role="alert"');
    expect(alert.textContent).toContain('Jawaban gagal disimpan. Coba kirim lagi.');
    await counterShown(1);
    expect(phraseShown(counter(2))).toBe(false);
    expect(await romajiInput()).toBeInstanceOf(HTMLInputElement);
    expect(await db.reviewLogs.count()).toBe(0);
    expect(await repository.getReviewStates([first.id])).toEqual([]);

    db.reviewLogs.hook('creating').unsubscribe(failLog);
    fireEvent.change(await romajiInput(), { target: { value: romajiOf(first) } });
    fireEvent.click(await submitButton());

    await counterShown(2);
    await wordShown(wordAt(2));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    }, WAIT);
    const log = await loggedOnce(db, first.id);
    expect(log.elapsedMs).toBe(1200);
    expect(await db.reviewLogs.count()).toBe(1);
  });

  it('should offer "Simpan lagi" without a result when saving the assessment fails, then save it and show "Lulus" when "Simpan lagi" is pressed', FULL_RUN, async () => {
    const failSave = (): void => {
      throw new Dexie.UnknownError('injected');
    };
    const { db, repository } = await start((opened) => {
      opened.assessments.hook('creating', failSave);
    });

    await runAll(1000);

    const retry = await button('Simpan lagi');
    expect(screen.queryByRole('heading', { level: 1, name: 'Lulus' })).toBeNull();
    expect(await repository.getAssessments()).toEqual([]);
    expect(await db.reviewLogs.count()).toBe(WORD_COUNT);

    db.assessments.hook('creating').unsubscribe(failSave);
    fireEvent.click(retry);

    await headingShown('Lulus');
    const saved = await onlyAssessment(repository);
    expect(saved).toMatchObject({ kind: 'kana-exit', passed: true, correct: 50, total: 50, elapsedMs: 50_000 });
  });
});
