import { fireEvent, screen, waitFor } from '@testing-library/react';
import { assert, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { contentBundle } from '@wara/content';
import type { KanaItem } from '@wara/content/schema';
import {
  DRILL_CHOICE_COUNT,
  NEW_ITEM_SEC,
  PRODUCTION_ITEM_SEC,
  RATING,
  type Repository,
  type ReviewLog,
  type ReviewState,
  type Session,
  type UserProfile,
} from '@wara/core';
import type { WaraDb } from '@/data/db';
import { speakJapanese } from '@/services/tts';
import { toLocalDate } from '@/utils/localDate';
import { renderApp } from '../../renderApp';

vi.mock('@/services/tts', () => ({ speakJapanese: vi.fn() }));

const WAIT = { timeout: 4000 };
const SLOW = { timeout: 30_000 };
const DAY_MS = 24 * 60 * 60 * 1000;
const ANSWER_PAUSE_MS = 40;

const PICK_ROMAJI_TO_KANA = 0.7;
const PICK_DICTATION = 0.2;

const DAILY_TARGET_MIN = 20;

const NE = 'kana:hira:ね';
const RE = 'kana:hira:れ';
const A = 'kana:hira:あ';
const I = 'kana:hira:い';
const TABERU = 'vocab:other:たべる';

const ALL_IDS: ReadonlyArray<string> = contentBundle.items.map((item) => item.id);

const KANA: ReadonlyArray<KanaItem> = contentBundle.items.flatMap((item) => (item.type === 'kana' ? [item] : []));

const HIRAGANA_ROMAJI: ReadonlySet<string> = new Set(
  KANA.flatMap((item) => (item.data.script === 'hiragana' && item.data.romaji !== '' ? [item.data.romaji] : [])),
);

const kanaById = (id: string): KanaItem => {
  const found = KANA.find((item) => item.id === id);
  assert.isDefined(found, `kana "${id}" tidak ada di konten`);
  return found;
};

const PROFILE: UserProfile = {
  id: 'me',
  name: 'Handal',
  dailyTargetMin: DAILY_TARGET_MIN,
  romajiAid: 'on-demand',
  theme: 'system',
  ttsVoiceUri: null,
  startDate: '2026-11-01',
  weakSeeds: [],
};

const speak = vi.mocked(speakJapanese);

const stated = (itemId: string, due: Date): ReviewState => ({
  itemId,
  stability: 12,
  difficulty: 5,
  due,
  lastReview: new Date(due.getTime() - 12 * DAY_MS),
  reps: 3,
  lapses: 0,
  learningSteps: 0,
  state: 'review',
});

const seedPlan =
  ({
    unseen = [],
    due = [],
    sessions = [],
  }: {
    readonly unseen?: ReadonlyArray<string>;
    readonly due?: ReadonlyArray<string>;
    readonly sessions?: ReadonlyArray<Session>;
  }) =>
  async (repository: Repository): Promise<void> => {
    await repository.saveProfile(PROFILE);
    const now = Date.now();
    const future = new Date(now + 10 * DAY_MS);
    await repository.commitReview(
      [
        ...ALL_IDS.filter((id) => !unseen.includes(id) && !due.includes(id)).map((id) => stated(id, future)),
        ...due.map((id, index) => stated(id, new Date(now - (due.length - index) * DAY_MS))),
      ],
      [],
    );
    for (const session of sessions) {
      await repository.saveSession(session);
    }
  };

const pinRandom = (value: number): void => {
  const spy = vi.spyOn(Math, 'random').mockReturnValue(value);
  onTestFinished(() => {
    spy.mockRestore();
  });
};

const pause = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\/]/gu, '\\$&');

const phrase = (text: string): RegExp =>
  new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(text).replace(/ /gu, '\\s+')}($|[^\\p{L}\\p{N}])`, 'u');

const matchShown = (pattern: RegExp): boolean =>
  screen.queryAllByText((_content, element) => element !== null && pattern.test(element.textContent)).length > 0;

const phraseShown = (text: string): boolean => matchShown(phrase(text));

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

const headingShown = (name: string): Promise<HTMLElement> =>
  present(() => screen.queryByRole('heading', { level: 1, name }), `judul "${name}" tidak ditampilkan`);

const glyphsOutsideButtons = (char: string): ReadonlyArray<HTMLElement> =>
  screen.queryAllByText(char).filter((element) => element.closest('button') === null);

const glyphShown = (char: string): Promise<void> =>
  waitFor(() => {
    const glyphs = glyphsOutsideButtons(char);
    assert.isNotEmpty(glyphs, `huruf ${char} tidak ditampilkan`);
    for (const glyph of glyphs) {
      expect(glyph.closest('[lang="ja"]')).not.toBeNull();
    }
  }, WAIT);

const romajiChoiceButtons = (): ReadonlyArray<HTMLElement> =>
  screen.queryAllByRole('button').filter((element) => HIRAGANA_ROMAJI.has(element.textContent.trim()));

const typeAnswer = async (text: string): Promise<void> => {
  fireEvent.change(
    await present(() => screen.queryByLabelText('Romaji'), 'input berlabel "Romaji" tidak ditemukan'),
    { target: { value: text } },
  );
  fireEvent.click(await button('Kirim'));
};

const answerReading = async (romaji: string): Promise<void> => {
  const control = await present(
    () => screen.queryByLabelText('Romaji') ?? screen.queryByRole('button', { name: romaji }),
    `tidak ada input "Romaji" maupun tombol "${romaji}"`,
  );
  if (control instanceof HTMLInputElement) {
    await typeAnswer(romaji);
    return;
  }
  fireEvent.click(control);
};

const headerShown = (index: number, count: number, label: string, remaining: number): Promise<void> =>
  waitPhrases([`Bagian ${String(index)} dari ${String(count)}`, label, `Sisa ${String(remaining)}`]);

const logsOf = (db: WaraDb, itemId: string): Promise<ReadonlyArray<ReviewLog>> =>
  db.reviewLogs.where('itemId').equals(itemId).toArray();

const onlySession = async (db: WaraDb): Promise<Session> => {
  const rows = await db.sessions.toArray();
  expect(rows).toHaveLength(1);
  const [row] = rows;
  assert.isDefined(row, 'baris sesi tidak ditulis');
  return row;
};

const contrastShown = (): boolean =>
  screen.queryAllByRole('heading').some((heading) => /Bedakan\s*ね\s*dan\s*れ/u.test(heading.textContent));

const pickContrast = async (round: number): Promise<void> => {
  const asked = await waitFor(() => {
    assert.isNull(screen.queryByText('Benar'), 'putaran kontras sebelumnya belum selesai');
    assert.isTrue(
      matchShown(new RegExp(`Benar berturut-turut:\\s*${String(round - 1)}\\s*/\\s*3`, 'u')),
      `"Benar berturut-turut: ${String(round - 1)}/3" tidak ditampilkan`,
    );
    if (phraseShown('Pilih: ne')) {
      return 'ね';
    }
    assert.isTrue(phraseShown('Pilih: re'), 'perintah "Pilih: ne" atau "Pilih: re" tidak ditampilkan');
    return 'れ';
  }, WAIT);
  fireEvent.click(await button(asked));
};

const doneShown = async (answered: number, correct: number): Promise<void> => {
  await headingShown('Sesi selesai');
  await waitPhrases([`${String(answered)} jawaban, ${String(correct)} benar.`]);
  expect((await link('Kembali ke Beranda')).getAttribute('href')).toBe('/');
};

beforeEach(() => {
  speak.mockReset();
});

describe('SessionPage — empty plan', () => {
  it('should show "Tidak ada yang perlu dilatih sekarang." with a "Kembali ke Beranda" link to / and write no session row when every item has a future state', async () => {
    pinRandom(PICK_ROMAJI_TO_KANA);
    const { db } = await renderApp({ path: '/sesi', seed: seedPlan({}) });

    await waitPhrases(['Tidak ada yang perlu dilatih sekarang.']);
    expect((await link('Kembali ke Beranda')).getAttribute('href')).toBe('/');
    expect(screen.queryByLabelText('Romaji')).toBeNull();
    expect(phraseShown('Bagian 1 dari 1')).toBe(false);
    expect(await db.sessions.count()).toBe(0);
  });

  it('should plan nothing and write no new session when the only unseen kana ね was already introduced in a session completed today', async () => {
    pinRandom(PICK_ROMAJI_TO_KANA);
    const today = toLocalDate(new Date());
    const morning: Session = {
      id: 'sesi-pagi',
      date: today,
      plannedMin: DAILY_TARGET_MIN,
      actualMin: 4,
      activities: [{ kind: 'new', itemIds: [NE], estimatedSec: NEW_ITEM_SEC, done: true }],
      cursor: 1,
      completed: true,
    };
    const { db } = await renderApp({ path: '/sesi', seed: seedPlan({ unseen: [NE], sessions: [morning] }) });

    await waitPhrases(['Tidak ada yang perlu dilatih sekarang.']);
    expect(glyphsOutsideButtons('ね')).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Mengerti' })).toBeNull();
    expect(await db.sessions.toArray()).toEqual([morning]);
  });
});

describe('SessionPage — new kana', () => {
  it('should save one unfinished session row for today with the planned new and production activities of ね, cursor 0 and actualMin 0, under a "Keluar" header without app navigation', async () => {
    pinRandom(PICK_ROMAJI_TO_KANA);
    const { db } = await renderApp({ path: '/sesi', seed: seedPlan({ unseen: [NE] }) });

    await headerShown(1, 2, 'Huruf baru', 1);
    expect((await link('Keluar')).getAttribute('href')).toBe('/');
    expect(screen.queryByRole('navigation', { name: 'Navigasi utama' })).toBeNull();

    const row = await waitFor(() => onlySession(db), WAIT);
    expect(row).toMatchObject({
      date: toLocalDate(new Date()),
      plannedMin: DAILY_TARGET_MIN,
      actualMin: 0,
      cursor: 0,
      completed: false,
    });
    expect(row.activities).toEqual([
      { kind: 'new', itemIds: [NE], estimatedSec: NEW_ITEM_SEC, done: false },
      { kind: 'production', itemIds: [NE], estimatedSec: PRODUCTION_ITEM_SEC, done: false },
    ]);
  });

  it('should show the intro card for the new ね with its romaji and mnemonic before any drill, and speak ね on "Dengar"', async () => {
    pinRandom(PICK_ROMAJI_TO_KANA);
    await renderApp({ path: '/sesi', seed: seedPlan({ unseen: [NE] }) });

    const understood = await button('Mengerti');
    await glyphShown('ね');
    const { mnemonic } = kanaById(NE).data;
    assert.isDefined(mnemonic, 'ね tidak punya mnemonic di konten');
    expect(phraseShown('ne')).toBe(true);
    expect(phraseShown(mnemonic)).toBe(true);
    expect(screen.queryByText('Bagaimana bacaan huruf ini?')).toBeNull();
    expect(screen.queryByLabelText('Romaji')).toBeNull();
    expect(romajiChoiceButtons()).toEqual([]);

    expect(speak).not.toHaveBeenCalled();
    fireEvent.click(await button('Dengar'));
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0]?.[0]).toBe('ね');
    expect(understood.isConnected).toBe(true);
  });

  it('should replace the intro card with a four-choice kana→romaji drill for ね, including ne, when "Mengerti" is pressed', async () => {
    pinRandom(PICK_ROMAJI_TO_KANA);
    await renderApp({ path: '/sesi', seed: seedPlan({ unseen: [NE] }) });

    fireEvent.click(await button('Mengerti'));

    await waitPhrases(['Bagaimana bacaan huruf ini?']);
    await glyphShown('ね');
    const choices = romajiChoiceButtons();
    expect(choices).toHaveLength(DRILL_CHOICE_COUNT.kanaToRomaji);
    expect(choices.map((choice) => choice.textContent.trim())).toContain('ne');
    expect(screen.queryByRole('button', { name: 'Mengerti' })).toBeNull();
    expect(screen.queryByLabelText('Romaji')).toBeNull();
    await headerShown(1, 2, 'Huruf baru', 1);
  });

  it('should commit ね with a state and one non-Again log, grow actualMin, mark the new activity done and move to "Bagian 2 dari 2 · Latihan" when ne is picked', SLOW, async () => {
    pinRandom(PICK_ROMAJI_TO_KANA);
    const { db } = await renderApp({ path: '/sesi', seed: seedPlan({ unseen: [NE] }) });
    fireEvent.click(await button('Mengerti'));
    await button('ne');
    await pause(ANSWER_PAUSE_MS);

    fireEvent.click(await button('ne'));

    await waitPhrases(['Benar']);
    await headerShown(2, 2, 'Latihan', 1);
    const row = await waitFor(async () => {
      const current = await onlySession(db);
      expect(current.cursor).toBe(1);
      return current;
    }, WAIT);
    expect(row.completed).toBe(false);
    expect(row.actualMin).toBeGreaterThan(0);
    expect(row.activities.map((entry) => entry.done)).toEqual([true, false]);
    expect(await db.reviewStates.get(NE)).toMatchObject({ itemId: NE });
    const logs = await logsOf(db, NE);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ itemId: NE, confusedWith: null });
    expect(logs[0]?.rating).toBeGreaterThan(RATING.again);
  });

  it('should ask the production ね as romaji→kana when Math.random is pinned at 0.7 and end with "Sesi selesai", "2 jawaban, 2 benar." and a completed session row', SLOW, async () => {
    pinRandom(PICK_ROMAJI_TO_KANA);
    const { db } = await renderApp({ path: '/sesi', seed: seedPlan({ unseen: [NE] }) });
    fireEvent.click(await button('Mengerti'));
    fireEvent.click(await button('ne'));
    await headerShown(2, 2, 'Latihan', 1);

    await waitPhrases(['Pilih huruf untuk bunyi ini']);
    expect(screen.queryByText('Dengarkan, lalu pilih hurufnya')).toBeNull();
    fireEvent.click(await button('ね'));

    await doneShown(2, 2);
    expect(screen.queryByRole('navigation', { name: 'Navigasi utama' })).toBeNull();
    const row = await waitFor(async () => {
      const current = await onlySession(db);
      expect(current.completed).toBe(true);
      return current;
    }, WAIT);
    expect(row.cursor).toBe(2);
    expect(row.activities.map((entry) => entry.done)).toEqual([true, true]);
    expect(await logsOf(db, NE)).toHaveLength(2);
  });

  it('should ask the production ね as dictation, speaking ね, when Math.random is pinned at 0.2', SLOW, async () => {
    pinRandom(PICK_DICTATION);
    await renderApp({ path: '/sesi', seed: seedPlan({ unseen: [NE] }) });
    fireEvent.click(await button('Mengerti'));
    fireEvent.click(await button('ne'));
    await headerShown(2, 2, 'Latihan', 1);

    await waitPhrases(['Dengarkan, lalu pilih hurufnya']);
    expect(screen.queryByText('Pilih huruf untuk bunyi ini')).toBeNull();
    expect(speak.mock.calls.map(([text]) => text)).toContain('ね');
    fireEvent.click(await button('ね'));

    await doneShown(2, 2);
  });
});

describe('SessionPage — new vocabulary', () => {
  it('should go straight to the word-reading drill for たべる without an intro card and commit it when taberu is typed', SLOW, async () => {
    pinRandom(PICK_ROMAJI_TO_KANA);
    const { db } = await renderApp({ path: '/sesi', seed: seedPlan({ unseen: [TABERU] }) });

    await headerShown(1, 2, 'Huruf baru', 1);
    await glyphShown('たべる');
    expect(screen.queryByRole('button', { name: 'Mengerti' })).toBeNull();
    await typeAnswer('taberu');

    await headerShown(2, 2, 'Latihan', 1);
    await waitFor(async () => {
      expect(await logsOf(db, TABERU)).toHaveLength(1);
    }, WAIT);
    expect(await db.reviewStates.get(TABERU)).toMatchObject({ itemId: TABERU });
    expect((await logsOf(db, TABERU))[0]?.rating).toBeGreaterThan(RATING.again);
  });
});

describe('SessionPage — review', () => {
  it('should ask the due review ね with the typed kana→romaji drill under "Bagian 1 dari 2 · Ulangan · Sisa 1"', async () => {
    pinRandom(PICK_ROMAJI_TO_KANA);
    await renderApp({ path: '/sesi', seed: seedPlan({ due: [NE] }) });

    await headerShown(1, 2, 'Ulangan', 1);
    await glyphShown('ね');
    expect(await present(() => screen.queryByLabelText('Romaji'), 'input "Romaji" tidak ditemukan')).toBeInstanceOf(
      HTMLInputElement,
    );
    expect(romajiChoiceButtons()).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Mengerti' })).toBeNull();
    expect(phraseShown('Huruf baru')).toBe(false);
  });

  it('should move ね due into the future, write one log and grow actualMin when the typed review answer ne is correct', SLOW, async () => {
    pinRandom(PICK_ROMAJI_TO_KANA);
    const { db } = await renderApp({ path: '/sesi', seed: seedPlan({ due: [NE] }) });
    await headerShown(1, 2, 'Ulangan', 1);
    await pause(ANSWER_PAUSE_MS);

    await typeAnswer('ne');

    await headerShown(2, 2, 'Latihan', 1);
    const logs = await waitFor(async () => {
      const written = await logsOf(db, NE);
      expect(written).toHaveLength(1);
      return written;
    }, WAIT);
    expect(logs[0]).toMatchObject({ itemId: NE, confusedWith: null });
    expect(logs[0]?.rating).toBeGreaterThan(RATING.again);
    const state = await db.reviewStates.get(NE);
    assert.isDefined(state, 'state ね hilang');
    expect(state.due.getTime()).toBeGreaterThan(Date.now());
    const row = await onlySession(db);
    expect(row.actualMin).toBeGreaterThan(0);
    expect(row.cursor).toBe(1);
    expect(row.activities.map((entry) => entry.done)).toEqual([true, false]);
  });

  it('should keep "Sisa 2", ask い next and ask あ again after い, logging every attempt, when あ is answered wrong in a review of あ and い', SLOW, async () => {
    pinRandom(PICK_ROMAJI_TO_KANA);
    const { db } = await renderApp({ path: '/sesi', seed: seedPlan({ due: [A, I] }) });
    await headerShown(1, 2, 'Ulangan', 2);
    await glyphShown('あ');

    await typeAnswer('ka');
    await waitPhrases(['Belum tepat']);
    fireEvent.click(await button('Lanjut'));

    await glyphShown('い');
    await headerShown(1, 2, 'Ulangan', 2);
    expect(glyphsOutsideButtons('あ')).toEqual([]);
    expect(screen.queryByText('Belum tepat')).toBeNull();
    const firstAttempt = await waitFor(async () => {
      const written = await logsOf(db, A);
      expect(written).toHaveLength(1);
      return written;
    }, WAIT);
    expect(firstAttempt[0]?.rating).toBe(RATING.again);

    await typeAnswer('i');

    await glyphShown('あ');
    await headerShown(1, 2, 'Ulangan', 1);
    expect(glyphsOutsideButtons('い')).toEqual([]);
    await answerReading('a');

    await headerShown(2, 2, 'Latihan', 2);
    const attempts = await waitFor(async () => {
      const written = await logsOf(db, A);
      expect(written).toHaveLength(2);
      return written;
    }, WAIT);
    expect(attempts.map((log) => log.rating > RATING.again).toSorted()).toEqual([false, true]);
    expect(await logsOf(db, I)).toHaveLength(1);
    const row = await onlySession(db);
    expect(row.cursor).toBe(1);
    expect(row.activities.map((entry) => entry.done)).toEqual([true, false]);
  });
});

describe('SessionPage — confusion', () => {
  it('should show the ね/れ contrast drill after "Lanjut", log ね as Again confused with れ, and pull れ due to now when ね is answered as re', SLOW, async () => {
    pinRandom(PICK_ROMAJI_TO_KANA);
    const { db } = await renderApp({ path: '/sesi', seed: seedPlan({ due: [NE] }) });
    await headerShown(1, 2, 'Ulangan', 1);

    await typeAnswer('re');
    await waitPhrases(['Belum tepat']);
    expect(contrastShown()).toBe(false);
    fireEvent.click(await button('Lanjut'));

    await waitFor(() => {
      assert.isTrue(contrastShown(), 'judul "Bedakan ね dan れ" tidak ditampilkan');
    }, WAIT);
    expect(screen.queryByLabelText('Romaji')).toBeNull();
    const logs = await waitFor(async () => {
      const written = await logsOf(db, NE);
      expect(written).toHaveLength(1);
      return written;
    }, WAIT);
    const answeredBy = Date.now();
    expect(logs[0]).toMatchObject({ itemId: NE, rating: RATING.again, confusedWith: RE });
    const partner = await db.reviewStates.get(RE);
    assert.isDefined(partner, 'state れ hilang');
    expect(partner.due.getTime()).toBeLessThanOrEqual(answeredBy);
  });

  it('should return to ね after three correct contrast picks and end with "3 jawaban, 2 benar." without counting the picks', SLOW, async () => {
    pinRandom(PICK_ROMAJI_TO_KANA);
    const { db } = await renderApp({ path: '/sesi', seed: seedPlan({ due: [NE] }) });
    await headerShown(1, 2, 'Ulangan', 1);
    await typeAnswer('re');
    fireEvent.click(await button('Lanjut'));
    await waitFor(() => {
      assert.isTrue(contrastShown(), 'judul "Bedakan ね dan れ" tidak ditampilkan');
    }, WAIT);

    await pickContrast(1);
    await pickContrast(2);
    await pickContrast(3);

    await waitFor(() => {
      assert.isFalse(contrastShown(), 'drill kontras masih ditampilkan');
    }, WAIT);
    await headerShown(1, 2, 'Ulangan', 1);
    await glyphShown('ね');
    await answerReading('ne');

    await headerShown(2, 2, 'Latihan', 1);
    await waitPhrases(['Pilih huruf untuk bunyi ini']);
    fireEvent.click(await button('ね'));

    await doneShown(3, 2);
    await waitFor(async () => {
      expect((await onlySession(db)).completed).toBe(true);
    }, WAIT);
    expect(await logsOf(db, NE)).toHaveLength(3);
  });
});
