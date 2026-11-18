import { fireEvent, screen, waitFor } from '@testing-library/react';
import Dexie from 'dexie';
import { afterEach, assert, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { contentBundle } from '@wara/content';
import type { Repository, ReviewState, Session, SessionActivity, SessionActivityKind, UserProfile } from '@wara/core';
import { renderApp } from '../../renderApp';

const WAIT = { timeout: 3000 };
const DAY_MS = 24 * 60 * 60 * 1000;

const NOW = new Date(2026, 10, 18, 12, 0, 0);
const TODAY = '2026-11-18';
const YESTERDAY = '2026-11-17';

const NE = 'kana:hira:ね';
const RE = 'kana:hira:れ';
const SO = 'kana:kata:ソ';

const ALL_IDS: ReadonlyArray<string> = contentBundle.items.map((item) => item.id);

const reviewState = (itemId: string, due: Date): ReviewState => ({
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

const FUTURE = new Date(NOW.getTime() + 10 * DAY_MS);
const PAST = new Date(NOW.getTime() - DAY_MS);

const profile: UserProfile = {
  id: 'me',
  name: 'Handal',
  dailyTargetMin: 30,
  romajiAid: 'on-demand',
  theme: 'system',
  ttsVoiceUri: null,
  startDate: '2026-11-01',
  weakSeeds: [],
};

const activity = (kind: SessionActivityKind, itemIds: ReadonlyArray<string>, done = false): SessionActivity => ({
  kind,
  itemIds,
  estimatedSec: itemIds.length * 10,
  done,
});

const session = (fields: Partial<Session> & Pick<Session, 'activities'>): Session => ({
  id: 'sesi-hari-ini',
  date: TODAY,
  plannedMin: 30,
  actualMin: 0,
  cursor: 0,
  completed: false,
  ...fields,
});

const seedWith =
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
    await repository.saveProfile(profile);
    await repository.commitReview(
      ALL_IDS.filter((id) => !unseen.includes(id)).map((id) => reviewState(id, due.includes(id) ? PAST : FUTURE)),
      [],
    );
    for (const entry of sessions) {
      await repository.saveSession(entry);
    }
  };

const present = (query: () => HTMLElement | null, message: string): Promise<HTMLElement> =>
  waitFor(() => {
    const element = query();
    assert.isNotNull(element, message);
    return element;
  }, WAIT);

const japaneseGlyphs = (char: string): ReadonlyArray<HTMLElement> =>
  screen.queryAllByText(char).filter((element) => element.closest('[lang="ja"]') !== null);

const glyphShown = (char: string): Promise<void> =>
  waitFor(() => {
    expect(japaneseGlyphs(char).length, `huruf ${char} tidak ditampilkan`).toBeGreaterThan(0);
  }, WAIT);

const textShown = (pattern: RegExp): boolean =>
  screen.queryAllByText((_content, element) => element !== null && pattern.test(element.textContent)).length > 0;

const progressShown = (part: number, of: number, remaining: number): Promise<void> =>
  waitFor(() => {
    expect(textShown(new RegExp(`Bagian\\s+${String(part)}\\s+dari\\s+${String(of)}(?!\\d)`, 'u')), `"Bagian ${String(part)} dari ${String(of)}" tidak ditampilkan`).toBe(true);
    expect(textShown(new RegExp(`Sisa\\s+${String(remaining)}(?!\\d)`, 'u')), `"Sisa ${String(remaining)}" tidak ditampilkan`).toBe(true);
  }, WAIT);

const remainingShown = (remaining: number): Promise<void> =>
  waitFor(() => {
    expect(textShown(new RegExp(`Sisa\\s+${String(remaining)}(?!\\d)`, 'u')), `"Sisa ${String(remaining)}" tidak ditampilkan`).toBe(true);
  }, WAIT);

const romajiInput = (): Promise<HTMLElement> =>
  present(() => screen.queryByLabelText('Romaji'), 'input berlabel "Romaji" tidak ditemukan');

const answerTyped = async (text: string): Promise<void> => {
  fireEvent.change(await romajiInput(), { target: { value: text } });
  fireEvent.click(
    await present(() => screen.queryByRole('button', { name: 'Kirim' }), 'tombol "Kirim" tidak ditemukan'),
  );
};

const headingShown = (name: string): Promise<HTMLElement> =>
  present(() => screen.queryByRole('heading', { level: 1, name }), `judul "${name}" tidak ditampilkan`);

const control = (name: string): HTMLElement | null =>
  screen.queryByRole('link', { name }) ?? screen.queryByRole('button', { name });

const silenceConsoleError = (): void => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  onTestFinished(() => {
    spy.mockRestore();
  });
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SessionPage — resuming today\'s unfinished session', () => {
  it('should resume today\'s unfinished session without planning a new one, asking ね as "Bagian 1 dari 1" with "Sisa 1" and never the due れ outside it', async () => {
    const stored = session({ activities: [activity('review', [NE])] });
    const { db } = await renderApp({ path: '/sesi', seed: seedWith({ due: [NE, RE], sessions: [stored] }) });

    await glyphShown('ね');
    await progressShown(1, 1, 1);
    expect(japaneseGlyphs('れ')).toHaveLength(0);
    expect(await romajiInput()).toBeInstanceOf(HTMLInputElement);
    expect(await db.sessions.count()).toBe(1);
    expect(await db.sessions.get(stored.id)).toEqual(stored);
  });

  it('should skip ね already answered in the review activity and ask only れ with "Sisa 1"', async () => {
    const stored = session({ activities: [activity('review', [NE, RE])] });
    const { db } = await renderApp({ path: '/sesi', seed: seedWith({ due: [RE], sessions: [stored] }) });

    await glyphShown('れ');
    await progressShown(1, 1, 1);
    expect(japaneseGlyphs('ね')).toHaveLength(0);
    expect(await db.sessions.count()).toBe(1);
  });

  it('should start from the cursor activity and never go back to the due ね of an earlier activity', async () => {
    const stored = session({
      activities: [activity('review', [NE], true), activity('new', [SO])],
      cursor: 1,
    });
    const { db } = await renderApp({
      path: '/sesi',
      seed: seedWith({ unseen: [SO], due: [NE], sessions: [stored] }),
    });

    await glyphShown('ソ');
    await progressShown(2, 2, 1);
    expect(japaneseGlyphs('ね')).toHaveLength(0);
    expect(await db.sessions.count()).toBe(1);
  });

  it('should save the drained review activity as done, advance the cursor to 1, and introduce ソ as "Bagian 2 dari 2" when nothing in the review activity is pending', async () => {
    const stored = session({ activities: [activity('review', [NE]), activity('new', [SO])] });
    const { db } = await renderApp({
      path: '/sesi',
      seed: seedWith({ unseen: [SO], sessions: [stored] }),
    });

    await glyphShown('ソ');
    await progressShown(2, 2, 1);
    expect(japaneseGlyphs('ね')).toHaveLength(0);
    await waitFor(async () => {
      expect(await db.sessions.get(stored.id)).toEqual({
        ...stored,
        activities: [activity('review', [NE], true), activity('new', [SO])],
        cursor: 1,
      });
    }, WAIT);
    expect(await db.sessions.count()).toBe(1);
  });

  it('should save the session completed with every activity done and show "Sesi selesai" when nothing is pending in any remaining activity', async () => {
    const stored = session({ activities: [activity('review', [NE]), activity('new', [SO])] });
    const { db } = await renderApp({ path: '/sesi', seed: seedWith({ sessions: [stored] }) });

    await headingShown('Sesi selesai');
    expect(control('Kembali ke Beranda')).not.toBeNull();
    expect(screen.queryByLabelText('Romaji')).toBeNull();
    await waitFor(async () => {
      expect(await db.sessions.get(stored.id)).toEqual({
        ...stored,
        activities: [activity('review', [NE], true), activity('new', [SO], true)],
        cursor: 2,
        completed: true,
      });
    }, WAIT);
    expect(await db.sessions.count()).toBe(1);
  });

  it('should plan and save a new session for today asking the due ね instead of resuming yesterday\'s unfinished session over ソ', async () => {
    const yesterday = session({
      id: 'sesi-kemarin',
      date: YESTERDAY,
      activities: [activity('production', [SO])],
    });
    const { db } = await renderApp({ path: '/sesi', seed: seedWith({ due: [NE], sessions: [yesterday] }) });

    await glyphShown('ね');
    await remainingShown(1);
    expect(japaneseGlyphs('ソ')).toHaveLength(0);
    const rows = await waitFor(async () => {
      const all = await db.sessions.toArray();
      expect(all).toHaveLength(2);
      return all;
    }, WAIT);
    const today = rows.find((row) => row.id !== yesterday.id);
    assert.isDefined(today, 'sesi hari ini tidak disimpan');
    expect(today).toMatchObject({ date: TODAY, cursor: 0, completed: false, actualMin: 0 });
    expect(today.activities[0]).toMatchObject({ kind: 'review', itemIds: [NE], done: false });
    expect(rows.find((row) => row.id === yesterday.id)?.date).toBe(YESTERDAY);
  });
});

describe('SessionPage — failures', () => {
  it('should show "Jawaban gagal disimpan. Coba jawab lagi.", ask ね again with an empty drill, and write nothing when commitReview fails, then move to れ once the write succeeds', async () => {
    const stored = session({ activities: [activity('review', [NE, RE])] });
    const failLog = (): void => {
      throw new Dexie.UnknownError('injected');
    };
    const { db } = await renderApp({
      path: '/sesi',
      seed: seedWith({ due: [NE, RE], sessions: [stored] }),
      beforeRender: (opened) => {
        opened.reviewLogs.hook('creating', failLog);
      },
    });
    await glyphShown('ね');
    await progressShown(1, 1, 2);

    await answerTyped('ne');
    await present(() => screen.queryByText('Benar'), '"Benar" tidak ditampilkan');

    const alert = await present(() => screen.queryByRole('alert'), 'tidak ada role="alert"');
    expect(alert.textContent).toContain('Jawaban gagal disimpan. Coba jawab lagi.');
    await glyphShown('ね');
    expect(japaneseGlyphs('れ')).toHaveLength(0);
    const input = await romajiInput();
    assert.instanceOf(input, HTMLInputElement);
    expect(input.value).toBe('');
    expect(input.readOnly).toBe(false);
    expect(screen.queryByText('Benar')).toBeNull();
    expect(await db.reviewStates.get(NE)).toEqual(reviewState(NE, PAST));
    expect(await db.reviewLogs.count()).toBe(0);
    expect(await db.sessions.get(stored.id)).toEqual(stored);

    db.reviewLogs.hook('creating').unsubscribe(failLog);
    await answerTyped('ne');

    await glyphShown('れ');
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    }, WAIT);
    expect(japaneseGlyphs('ね')).toHaveLength(0);
    const logs = await db.reviewLogs.where('itemId').equals(NE).toArray();
    expect(logs).toHaveLength(1);
    const answered = await db.reviewStates.get(NE);
    assert.isDefined(answered, 'state ね hilang');
    expect(answered.due.getTime()).toBeGreaterThan(NOW.getTime());
    expect(await db.reviewLogs.count()).toBe(1);
  });

  it('should show the route error "Terjadi kesalahan" when the review states cannot be read while opening', async () => {
    silenceConsoleError();
    await renderApp({
      path: '/sesi',
      seed: seedWith({ due: [NE], sessions: [session({ activities: [activity('review', [NE])] })] }),
      beforeRender: (opened) => {
        opened.reviewStates.hook('reading', () => {
          throw new Dexie.UnknownError('gagal baca');
        });
      },
    });

    await headingShown('Terjadi kesalahan');
    expect(screen.queryByLabelText('Romaji')).toBeNull();
  });

  it('should show the route error "Terjadi kesalahan" when the sessions cannot be read while opening', async () => {
    silenceConsoleError();
    await renderApp({
      path: '/sesi',
      seed: seedWith({ due: [NE], sessions: [session({ activities: [activity('review', [NE])] })] }),
      beforeRender: (opened) => {
        opened.sessions.hook('reading', () => {
          throw new Dexie.UnknownError('gagal baca');
        });
      },
    });

    await headingShown('Terjadi kesalahan');
    expect(screen.queryByLabelText('Romaji')).toBeNull();
  });
});

describe('SessionPage — leaving', () => {
  it('should keep the session unfinished after "Keluar", offer "Lanjutkan sesi" on Beranda, and resume at れ with "Sisa 1" after ね was answered', async () => {
    const stored = session({ activities: [activity('review', [NE, RE])] });
    const { db, router } = await renderApp({
      path: '/sesi',
      seed: seedWith({ due: [NE, RE], sessions: [stored] }),
    });
    await glyphShown('ね');
    await answerTyped('ne');
    await glyphShown('れ');
    await waitFor(async () => {
      expect((await db.reviewStates.get(NE))?.due.getTime()).toBeGreaterThan(NOW.getTime());
    }, WAIT);

    fireEvent.click(await present(() => screen.queryByRole('link', { name: 'Keluar' }), 'tautan "Keluar" tidak ditemukan'));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    }, WAIT);
    const resume = await present(() => control('Lanjutkan sesi'), '"Lanjutkan sesi" tidak ditampilkan di Beranda');
    expect(await db.sessions.get(stored.id)).toMatchObject({ completed: false, cursor: 0 });
    expect(await db.sessions.count()).toBe(1);

    fireEvent.click(resume);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sesi');
    }, WAIT);
    await glyphShown('れ');
    await progressShown(1, 1, 1);
    expect(japaneseGlyphs('ね')).toHaveLength(0);
    expect(await db.sessions.count()).toBe(1);
  });

  it('should redirect /sesi to /mulai and write no session when there is no profile', async () => {
    const { db, router } = await renderApp({ path: '/sesi' });

    await headingShown('Selamat datang');
    expect(router.state.location.pathname).toBe('/mulai');
    expect(await db.sessions.count()).toBe(0);
  });
});
