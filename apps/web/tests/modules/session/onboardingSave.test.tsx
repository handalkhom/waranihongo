import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import Dexie from 'dexie';
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { contentBundle } from '@wara/content';
import { RepositoryError, type ReviewState, type UserProfile } from '@wara/core';
import type { WaraDb } from '@/data/db';
import { renderApp, type RenderedApp } from '../../renderApp';

const WAIT = { timeout: 3000 };

const NOW = new Date(2026, 10, 17, 0, 30);
const TODAY = '2026-11-17';

const SAVE_FAILED = 'Profil gagal disimpan. Coba lagi.';

const SEED_CHOICES = ['ぴ', 'しゃ', 'しゅ', 'しょ'] as const;

const hira = (char: string): string => `kana:hira:${char}`;

const BASIC_KANA_IDS: ReadonlyArray<string> = contentBundle.items.flatMap((item) =>
  item.type === 'kana' && item.data.group === 'basic' ? [item.id] : [],
);

const reviewed = (itemId: string): ReviewState => ({
  itemId,
  stability: 12,
  difficulty: 5,
  due: new Date(2026, 10, 25, 9, 0),
  lastReview: new Date(2026, 10, 13, 9, 0),
  reps: 4,
  lapses: 0,
  learningSteps: 0,
  state: 'review',
});

const seedStates =
  (ids: ReadonlyArray<string>) =>
  async (repository: RenderedApp['repository']): Promise<void> => {
    await repository.commitReview(ids.map(reviewed), []);
  };

const ALL_BASIC_STATED = seedStates(BASIC_KANA_IDS);

const failProfileCreation = (db: WaraDb): (() => void) => {
  const fail = (): never => {
    throw new Dexie.UnknownError('injected');
  };
  db.profile.hook('creating', fail);
  return () => {
    db.profile.hook('creating').unsubscribe(fail);
  };
};

const holdProfileStore = (db: WaraDb): (() => Promise<void>) => {
  const transaction = db.backendDB().transaction('profile', 'readwrite');
  const store = transaction.objectStore('profile');
  const hold = { active: true };
  const keepAlive = (): void => {
    if (!hold.active) {
      return;
    }
    store.get('me').onsuccess = keepAlive;
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

const fillProfile = async ({
  name,
  target,
}: {
  readonly name: string;
  readonly target?: string;
}): Promise<void> => {
  const nameInput = await screen.findByRole('textbox', { name: 'Nama panggilan' }, WAIT);
  fireEvent.change(nameInput, { target: { value: name } });
  if (target !== undefined) {
    const select = screen.getByRole('combobox', { name: 'Target per hari' });
    const option = within(select).getByRole('option', { name: target });
    assert.instanceOf(option, HTMLOptionElement);
    fireEvent.change(select, { target: { value: option.value } });
    expect(select).toHaveProperty('value', option.value);
  }
  fireEvent.click(screen.getByRole('button', { name: 'Mulai uji cepat' }));
};

const reachFinish = async (profile: { readonly name: string; readonly target?: string } = { name: 'Alan' }): Promise<void> => {
  await fillProfile(profile);
  await screen.findByRole('heading', { name: 'Hampir selesai' }, WAIT);
};

const seedCheckbox = (char: string): HTMLElement => screen.getByRole('checkbox', { name: char });

const expectChecklist = (chars: ReadonlyArray<string>): void => {
  const all = screen.getAllByRole('checkbox');
  expect(all).toHaveLength(chars.length);
  expect(chars.map((char) => all.indexOf(seedCheckbox(char)))).toEqual(chars.map((_char, index) => index));
};

const romajiAidRadio = (name: string): HTMLElement =>
  within(screen.getByRole('group', { name: 'Bantuan romaji' })).getByRole('radio', { name });

const pressSave = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Simpan' }));
};

const expectRedirectedHome = async (router: RenderedApp['router']): Promise<void> => {
  await waitFor(() => {
    expect(router.state.location.pathname).toBe('/');
  }, WAIT);
  await screen.findByRole('heading', { level: 1, name: 'Beranda' }, WAIT);
};

const savedProfile = (overrides: Partial<UserProfile>): UserProfile => ({
  id: 'me',
  name: 'Alan',
  dailyTargetMin: 30,
  romajiAid: 'on-demand',
  theme: 'system',
  ttsVoiceUri: null,
  startDate: TODAY,
  weakSeeds: SEED_CHOICES.map(hira),
  ...overrides,
});

describe('OnboardingPage finish step and save', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should list ぴ しゃ しゅ しょ checked in seed order, never っ, with romaji aid on-demand when every basic kana is reviewed', async () => {
    await renderApp({ path: '/mulai', seed: ALL_BASIC_STATED });

    await reachFinish();

    expect(screen.getByRole('heading', { name: 'Huruf yang masih lemah' })).toBeTruthy();
    expectChecklist(SEED_CHOICES);
    for (const char of SEED_CHOICES) {
      expect(seedCheckbox(char)).toHaveProperty('checked', true);
    }
    expect(screen.queryByRole('checkbox', { name: 'っ' })).toBeNull();
    expect(romajiAidRadio('Tampil saat diminta')).toHaveProperty('checked', true);
    expect(romajiAidRadio('Selalu tampil')).toHaveProperty('checked', false);
    expect(romajiAidRadio('Tidak tampil')).toHaveProperty('checked', false);
    expect(screen.getByRole('button', { name: 'Simpan' })).toHaveProperty('disabled', false);
  });

  it('should save the trimmed name, 45 minutes, always-on romaji aid, today as start date, and only the checked seeds, then redirect to /', async () => {
    const { repository, router } = await renderApp({ path: '/mulai', seed: ALL_BASIC_STATED });

    await reachFinish({ name: '  Alan  ', target: '45 menit' });
    fireEvent.click(seedCheckbox('しゅ'));
    expect(seedCheckbox('しゅ')).toHaveProperty('checked', false);
    fireEvent.click(romajiAidRadio('Selalu tampil'));
    expect(romajiAidRadio('Selalu tampil')).toHaveProperty('checked', true);
    pressSave();

    await expectRedirectedHome(router);
    expect(await repository.getProfile()).toEqual(
      savedProfile({
        dailyTargetMin: 45,
        romajiAid: 'always',
        weakSeeds: [hira('ぴ'), hira('しゃ'), hira('しょ')],
      }),
    );
  });

  it('should save 30 minutes, on-demand romaji aid, and all four seeds when the defaults are left untouched', async () => {
    const { repository, router } = await renderApp({ path: '/mulai', seed: ALL_BASIC_STATED });

    await reachFinish();
    pressSave();

    await expectRedirectedHome(router);
    expect(await repository.getProfile()).toEqual(savedProfile({}));
  });

  it('should list a seed skipped with "Belum kenal" first, write no review for it, and save it first in weakSeeds', async () => {
    const { repository, router } = await renderApp({
      path: '/mulai',
      seed: seedStates(BASIC_KANA_IDS.filter((id) => id !== hira('ね'))),
    });

    await fillProfile({ name: 'Alan' });
    fireEvent.click(await screen.findByRole('button', { name: 'Belum kenal' }, WAIT));
    await screen.findByRole('heading', { name: 'Hampir selesai' }, WAIT);

    expectChecklist(['ね', ...SEED_CHOICES]);
    expect(seedCheckbox('ね')).toHaveProperty('checked', true);
    expect(await repository.getReviewStates([hira('ね')])).toEqual([]);

    pressSave();

    await expectRedirectedHome(router);
    expect(await repository.getProfile()).toEqual(
      savedProfile({ weakSeeds: [hira('ね'), ...SEED_CHOICES.map(hira)] }),
    );
  });

  it('should hide the weak-seed checklist and save empty weakSeeds when every seed already has a review state', async () => {
    const { repository, router } = await renderApp({
      path: '/mulai',
      seed: seedStates([...BASIC_KANA_IDS, ...SEED_CHOICES.map(hira)]),
    });

    await reachFinish();

    expect(screen.queryByRole('heading', { name: 'Huruf yang masih lemah' })).toBeNull();
    expect(screen.queryAllByRole('checkbox')).toEqual([]);
    expect(romajiAidRadio('Tampil saat diminta')).toHaveProperty('checked', true);
    pressSave();

    await expectRedirectedHome(router);
    expect(await repository.getProfile()).toEqual(savedProfile({ weakSeeds: [] }));
  });

  it('should show "Menyimpan…" on a disabled button while the profile write is pending, then redirect to /', async () => {
    const { db, repository, router } = await renderApp({ path: '/mulai', seed: ALL_BASIC_STATED });

    await reachFinish();
    const release = holdProfileStore(db);
    pressSave();

    const saving = await screen.findByRole('button', { name: 'Menyimpan…' }, WAIT);
    expect(saving).toHaveProperty('disabled', true);
    expect(screen.queryByRole('button', { name: 'Simpan' })).toBeNull();
    expect(router.state.location.pathname).toBe('/mulai');

    await release();

    await expectRedirectedHome(router);
    expect(await repository.getProfile()).toEqual(savedProfile({}));
  });

  it('should show the save-failed alert under an enabled "Simpan", stay on /mulai, and store no profile when saveProfile throws RepositoryError', async () => {
    const { repository, router } = await renderApp({
      path: '/mulai',
      seed: ALL_BASIC_STATED,
      beforeRender: (db) => {
        failProfileCreation(db);
      },
    });
    await expect(repository.saveProfile(savedProfile({}))).rejects.toBeInstanceOf(RepositoryError);

    await reachFinish();
    pressSave();

    const alert = await screen.findByRole('alert', {}, WAIT);
    expect(alert.textContent.trim()).toBe(SAVE_FAILED);
    const save = await screen.findByRole('button', { name: 'Simpan' }, WAIT);
    expect(save).toHaveProperty('disabled', false);
    expect(save.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(router.state.location.pathname).toBe('/mulai');
    expect(screen.getByRole('heading', { name: 'Hampir selesai' })).toBeTruthy();
    expect(await repository.getProfile()).toBeNull();
  });

  it('should save the profile and redirect to / when "Simpan" is pressed again after a failed save', async () => {
    const restore = { profileCreation: (): void => undefined };
    const { repository, router } = await renderApp({
      path: '/mulai',
      seed: ALL_BASIC_STATED,
      beforeRender: (db) => {
        restore.profileCreation = failProfileCreation(db);
      },
    });

    await reachFinish();
    pressSave();
    await screen.findByRole('alert', {}, WAIT);
    restore.profileCreation();
    fireEvent.click(await screen.findByRole('button', { name: 'Simpan' }, WAIT));

    await expectRedirectedHome(router);
    expect(await repository.getProfile()).toEqual(savedProfile({}));
  });
});
