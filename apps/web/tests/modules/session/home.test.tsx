import { fireEvent, screen, waitFor, within, type Matcher } from '@testing-library/react';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import type { Repository, ReviewState, Session, UserProfile } from '@wara/core';
import type { WaraDb } from '@/data/db';
import { renderApp } from '../../renderApp';

const WAIT = { timeout: 3000 };

const NOW = new Date(2026, 10, 18, 9, 0);
const TODAY = '2026-11-18';
const YESTERDAY = '2026-11-17';
const NAV = 'Navigasi utama';

const profile: UserProfile = {
  id: 'me',
  name: 'Alan',
  dailyTargetMin: 30,
  romajiAid: 'on-demand',
  theme: 'system',
  ttsVoiceUri: null,
  startDate: '2026-11-01',
  weakSeeds: [],
};

const state = (itemId: string, due: Date): ReviewState => ({
  itemId,
  stability: 12,
  difficulty: 5,
  due,
  lastReview: new Date(2026, 10, 10, 9, 0),
  reps: 3,
  lapses: 0,
  learningSteps: 0,
  state: 'review',
});

const NOT_DUE = state('kana:hira:あ', new Date(2026, 10, 25, 9, 0));

const session = (id: string, date: string, completed: boolean): Session => ({
  id,
  date,
  plannedMin: 30,
  actualMin: completed ? 30 : 10,
  activities: [],
  cursor: completed ? 0 : 1,
  completed,
});

const seedHome =
  ({
    sessions = [],
    states = [NOT_DUE],
  }: {
    readonly sessions?: ReadonlyArray<Session>;
    readonly states?: ReadonlyArray<ReviewState>;
  }) =>
  async (repository: Repository): Promise<void> => {
    await repository.saveProfile(profile);
    await repository.commitReview(states, []);
    for (const row of sessions) {
      await repository.saveSession(row);
    }
  };

const normalize = (text: string | null): string => (text ?? '').replace(/\s+/g, ' ').trim();

const exactText =
  (text: string): Matcher =>
  (_content, element) =>
    element !== null &&
    normalize(element.textContent) === text &&
    Array.from(element.children).every((child) => normalize(child.textContent) !== text);

const findText = (text: string): Promise<HTMLElement> => screen.findByText(exactText(text), {}, WAIT);

const queryText = (text: string): HTMLElement | null => screen.queryByText(exactText(text));

const waitForHome = async (): Promise<void> => {
  await findText('Halo, Alan');
};

const expectSessionLink = (name: string): void => {
  expect(screen.getByRole('link', { name }).getAttribute('href')).toBe('/sesi');
};

const holdSessionsStore = (db: WaraDb): (() => Promise<void>) => {
  const transaction = db.backendDB().transaction('sessions', 'readwrite');
  const store = transaction.objectStore('sessions');
  const hold = { active: true };
  const keepAlive = (): void => {
    if (!hold.active) {
      return;
    }
    store.get('penahan').onsuccess = keepAlive;
  };
  keepAlive();
  const finished = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve();
    };
    transaction.onerror = () => {
      reject(new Error('transaksi penahan gagal'));
    };
  });
  return async () => {
    hold.active = false;
    await finished;
  };
};

const failSessionReads = (db: WaraDb): void => {
  db.sessions.hook('reading', () => {
    throw new Dexie.UnknownError('gagal baca sesi');
  });
};

const silenceConsoleError = (): void => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  onTestFinished(() => {
    spy.mockRestore();
  });
};

describe('HomePage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should show the page loader inside the layout while sessions cannot be read yet, then the greeting once they can', async () => {
    const held = { release: (): Promise<void> => Promise.resolve() };
    await renderApp({
      seed: seedHome({ sessions: [session('s-kemarin', YESTERDAY, true)] }),
      beforeRender: (db) => {
        held.release = holdSessionsStore(db);
      },
    });

    await screen.findByRole('navigation', { name: NAV }, WAIT);
    const loader = await screen.findByRole('status', {}, WAIT);
    expect(within(loader).getByText('Memuat…')).toBeTruthy();
    expect(queryText('Halo, Alan')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Mulai sesi hari ini' })).toBeNull();

    await held.release();

    await waitForHome();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText(exactText('1 hari berturut-turut'))).toBeTruthy();
  });

  it('should keep the Beranda h1 and greet the learner by name in a paragraph that is not a heading', async () => {
    await renderApp({ seed: seedHome({}) });

    await waitForHome();
    expect(screen.getByRole('heading', { level: 1, name: 'Beranda' })).toBeTruthy();
    const greeting = screen.getByText(exactText('Halo, Alan'));
    expect(greeting.closest('h1, h2, h3, h4, h5, h6, [role="heading"]')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Halo, Alan' })).toBeNull();
  });

  it('should show "0 hari berturut-turut" and "Perlu diulang: 0" when there is no session and nothing is due', async () => {
    await renderApp({ seed: seedHome({}) });

    await waitForHome();
    expect(screen.getByText(exactText('0 hari berturut-turut'))).toBeTruthy();
    expect(screen.getByText(exactText('Perlu diulang: 0'))).toBeTruthy();
  });

  it('should count a streak of 4 across a forgiven missed day when sessions completed on the 18th, 17th, 15th and 14th', async () => {
    await renderApp({
      seed: seedHome({
        sessions: [
          session('s-18', TODAY, true),
          session('s-17', YESTERDAY, true),
          session('s-15', '2026-11-15', true),
          session('s-14', '2026-11-14', true),
          session('s-12-belum', '2026-11-12', false),
        ],
      }),
    });

    await waitForHome();
    expect(screen.getByText(exactText('4 hari berturut-turut'))).toBeTruthy();
  });

  it('should keep yesterday\'s streak of 2 when today has only an unfinished session', async () => {
    await renderApp({
      seed: seedHome({
        sessions: [
          session('s-16', '2026-11-16', true),
          session('s-17', YESTERDAY, true),
          session('s-18-belum', TODAY, false),
        ],
      }),
    });

    await waitForHome();
    expect(screen.getByText(exactText('2 hari berturut-turut'))).toBeTruthy();
  });

  it('should count kana and vocab states due before or exactly now as due, and not a state due 1 ms after now', async () => {
    await renderApp({
      seed: seedHome({
        states: [
          state('kana:hira:ね', new Date(2026, 10, 17, 9, 0)),
          state('vocab:other:たべる', NOW),
          state('kana:hira:れ', new Date(NOW.getTime() + 1)),
          NOT_DUE,
        ],
      }),
    });

    await waitForHome();
    expect(screen.getByText(exactText('Perlu diulang: 2'))).toBeTruthy();
  });

  it('should offer "Mulai sesi hari ini" linking to /sesi when there is no session today', async () => {
    await renderApp({ seed: seedHome({ sessions: [session('s-kemarin', YESTERDAY, true)] }) });

    await waitForHome();
    expectSessionLink('Mulai sesi hari ini');
    expect(screen.queryByRole('link', { name: 'Lanjutkan sesi' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Mulai sesi lagi' })).toBeNull();
    expect(queryText('Sesi hari ini selesai.')).toBeNull();
  });

  it('should offer "Lanjutkan sesi" linking to /sesi when a session dated today is unfinished', async () => {
    await renderApp({ seed: seedHome({ sessions: [session('s-hari-ini', TODAY, false)] }) });

    await waitForHome();
    expectSessionLink('Lanjutkan sesi');
    expect(screen.queryByRole('link', { name: 'Mulai sesi hari ini' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Mulai sesi lagi' })).toBeNull();
  });

  it('should prefer "Lanjutkan sesi" over the finished message when today has both a completed and an unfinished session', async () => {
    await renderApp({
      seed: seedHome({
        sessions: [session('s-hari-ini-1', TODAY, true), session('s-hari-ini-2', TODAY, false)],
      }),
    });

    await waitForHome();
    expectSessionLink('Lanjutkan sesi');
    expect(queryText('Sesi hari ini selesai.')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Mulai sesi lagi' })).toBeNull();
  });

  it('should show "Sesi hari ini selesai." and a "Mulai sesi lagi" link to /sesi when today\'s only session is completed', async () => {
    await renderApp({ seed: seedHome({ sessions: [session('s-hari-ini', TODAY, true)] }) });

    await waitForHome();
    expect(screen.getByText(exactText('Sesi hari ini selesai.'))).toBeTruthy();
    expectSessionLink('Mulai sesi lagi');
    expect(screen.queryByRole('link', { name: 'Mulai sesi hari ini' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Lanjutkan sesi' })).toBeNull();
  });

  it('should offer "Mulai sesi hari ini", not "Lanjutkan sesi", when the unfinished session is dated yesterday', async () => {
    await renderApp({ seed: seedHome({ sessions: [session('s-kemarin-belum', YESTERDAY, false)] }) });

    await waitForHome();
    expectSessionLink('Mulai sesi hari ini');
    expect(screen.queryByRole('link', { name: 'Lanjutkan sesi' })).toBeNull();
  });

  it('should treat the local date as today at 00:30, so yesterday\'s unfinished session does not offer "Lanjutkan sesi"', async () => {
    vi.setSystemTime(new Date(2026, 10, 18, 0, 30));
    await renderApp({ seed: seedHome({ sessions: [session('s-kemarin-belum', YESTERDAY, false)] }) });

    await waitForHome();
    expectSessionLink('Mulai sesi hari ini');
    expect(screen.queryByRole('link', { name: 'Lanjutkan sesi' })).toBeNull();
  });

  it('should navigate to /sesi and leave Beranda when "Mulai sesi hari ini" is followed', async () => {
    const { router } = await renderApp({ seed: seedHome({}) });

    await waitForHome();
    fireEvent.click(screen.getByRole('link', { name: 'Mulai sesi hari ini' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sesi');
    }, WAIT);
    await waitFor(() => {
      expect(screen.queryByRole('heading', { level: 1, name: 'Beranda' })).toBeNull();
    }, WAIT);
    expect(queryText('Halo, Alan')).toBeNull();
  });

  it('should show "Terjadi kesalahan" instead of Beranda when the sessions cannot be read', async () => {
    silenceConsoleError();
    await renderApp({
      seed: seedHome({
        sessions: [session('s-kemarin', YESTERDAY, true), session('s-hari-ini', TODAY, false)],
      }),
      beforeRender: failSessionReads,
    });

    await screen.findByRole('heading', { level: 1, name: 'Terjadi kesalahan' }, WAIT);
    expect(screen.queryByRole('heading', { level: 1, name: 'Beranda' })).toBeNull();
    expect(queryText('Halo, Alan')).toBeNull();
  });

  it('should re-render to the finished state, streak 1 and one due item when a session and a due state are written after render', async () => {
    const { repository } = await renderApp({ seed: seedHome({}) });

    await waitForHome();
    expectSessionLink('Mulai sesi hari ini');
    expect(screen.getByText(exactText('0 hari berturut-turut'))).toBeTruthy();

    await repository.saveSession(session('s-hari-ini', TODAY, true));

    await findText('Sesi hari ini selesai.');
    expectSessionLink('Mulai sesi lagi');
    expect(screen.queryByRole('link', { name: 'Mulai sesi hari ini' })).toBeNull();
    expect(screen.getByText(exactText('1 hari berturut-turut'))).toBeTruthy();

    await repository.commitReview([state('kana:hira:ぬ', NOW)], []);

    await findText('Perlu diulang: 1');
  });
});
