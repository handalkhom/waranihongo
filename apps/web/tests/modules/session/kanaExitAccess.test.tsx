import { fireEvent, screen, waitFor, type Matcher } from '@testing-library/react';
import { assert, describe, expect, it, onTestFinished, vi } from 'vitest';
import { contentBundle } from '@wara/content';
import type { KanaItem } from '@wara/content/schema';
import {
  kanaExitWords,
  type KanaExitAssessment,
  type Repository,
  type ReviewState,
  type UserProfile,
} from '@wara/core';
import { renderApp, type RenderedApp } from '../../renderApp';

vi.mock('@/services/tts', () => ({ speakJapanese: vi.fn() }));

const WAIT = { timeout: 3000 };
const DAY_MS = 24 * 60 * 60 * 1000;
const NO_SWAP = 0.999999;

const PATH = '/tes/kana-exit';
const TITLE = 'Tes keluar Fase 0';
const LOCKED_COPY = 'Tes ini terbuka setelah setiap kana pernah diulang sekali.';
const PASSED_COPY = 'Kamu sudah lulus tes ini.';
const BACK = 'Kembali ke Beranda';
const NAV = 'Navigasi utama';

const SO = 'kana:kata:ソ';
const SOKUON_AND_CHOONPU: ReadonlyArray<string> = ['kana:hira:っ', 'kana:kata:ッ', 'kana:kata:ー'];

const KANA: ReadonlyArray<KanaItem> = contentBundle.items.flatMap((item) => (item.type === 'kana' ? [item] : []));

const DRILLABLE_IDS: ReadonlyArray<string> = KANA.filter(
  (item) => item.data.romaji !== '' && item.supersededBy === undefined,
).map((item) => item.id);

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

const kanaExit = (id: string, passed: boolean): KanaExitAssessment => ({
  id,
  date: '2026-11-20',
  kind: 'kana-exit',
  passed,
  correct: passed ? 50 : 47,
  total: 50,
  elapsedMs: passed ? 100_000 : 140_000,
  wrong: passed ? [] : ['vocab:n5:友達'],
});

const seedAccess =
  ({
    stateIds = DRILLABLE_IDS,
    assessments = [],
  }: {
    readonly stateIds?: ReadonlyArray<string>;
    readonly assessments?: ReadonlyArray<KanaExitAssessment>;
  }) =>
  async (repository: Repository): Promise<void> => {
    await repository.saveProfile(profile);
    const future = new Date(Date.now() + 10 * DAY_MS);
    await repository.commitReview(
      stateIds.map((id) => stated(id, future)),
      [],
    );
    for (const assessment of assessments) {
      await repository.saveAssessment(assessment);
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

const pinRandom = (value: number): void => {
  const spy = vi.spyOn(Math, 'random').mockReturnValue(value);
  onTestFinished(() => {
    spy.mockRestore();
  });
};

const expectBackLink = (): HTMLElement => {
  const link = screen.getByRole('link', { name: BACK });
  expect(link.getAttribute('href')).toBe('/');
  return link;
};

const expectSettledOn = async (router: RenderedApp['router'], pathname: string, heading: string): Promise<void> => {
  await waitFor(() => {
    expect(router.state.location.pathname).toBe(pathname);
  }, WAIT);
  await screen.findByRole('heading', { level: 1, name: heading }, WAIT);
  expect(router.state.location.pathname).toBe(pathname);
};

describe('TestPage access to /tes/kana-exit', () => {
  it('should show the locked copy and a link back to Beranda, without "Siap", when one drillable kana has no review state', async () => {
    assert.include(DRILLABLE_IDS, SO, `kana "${SO}" harus bisa didrill`);
    await renderApp({ path: PATH, seed: seedAccess({ stateIds: DRILLABLE_IDS.filter((id) => id !== SO) }) });

    await screen.findByRole('heading', { level: 1, name: TITLE }, WAIT);
    expect(await findText(LOCKED_COPY)).toBeTruthy();
    expectBackLink();
    expect(screen.queryByRole('button', { name: 'Siap' })).toBeNull();
    expect(screen.queryByText(exactText(PASSED_COPY))).toBeNull();
  });

  it('should open the test with "Siap" when only っ, ッ and ー have no review state', async () => {
    for (const id of SOKUON_AND_CHOONPU) {
      assert.isTrue(
        KANA.some((item) => item.id === id),
        `kana "${id}" tidak ada di konten`,
      );
      assert.notInclude(DRILLABLE_IDS, id, `kana "${id}" tidak boleh dihitung`);
    }
    pinRandom(NO_SWAP);
    await renderApp({ path: PATH, seed: seedAccess({}) });

    expect(await screen.findByRole('button', { name: 'Siap' }, WAIT)).toBeTruthy();
    expect(screen.queryByText(exactText(LOCKED_COPY))).toBeNull();
  });

  it('should show the passed copy and a link back to Beranda, without "Siap", when a passed kana-exit exists', async () => {
    await renderApp({
      path: PATH,
      seed: seedAccess({ assessments: [kanaExit('tes-gagal', false), kanaExit('tes-lulus', true)] }),
    });

    await screen.findByRole('heading', { level: 1, name: TITLE }, WAIT);
    expect(await findText(PASSED_COPY)).toBeTruthy();
    expectBackLink();
    expect(screen.queryByRole('button', { name: 'Siap' })).toBeNull();
    expect(screen.queryByText(exactText(LOCKED_COPY))).toBeNull();
  });

  it('should show "Keluar", "Kata 1 dari 50", the first pinned word in Japanese and "Siap" when every drillable kana is reviewed and only a failed kana-exit exists', async () => {
    pinRandom(NO_SWAP);
    const firstWord = kanaExitWords({ items: contentBundle.items, rng: () => NO_SWAP })[0];
    assert.isDefined(firstWord, 'kata pertama tes keluar tidak ada');
    await renderApp({ path: PATH, seed: seedAccess({ assessments: [kanaExit('tes-gagal', false)] }) });

    expect(await screen.findByRole('button', { name: 'Siap' }, WAIT)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Keluar' }).getAttribute('href')).toBe('/');
    expect(screen.getByText(exactText('Kata 1 dari 50'))).toBeTruthy();
    const word = screen.getByText(exactText(firstWord.data.word));
    expect(word.closest('[lang="ja"]')).not.toBeNull();
    expect(screen.queryByText(exactText(LOCKED_COPY))).toBeNull();
    expect(screen.queryByText(exactText(PASSED_COPY))).toBeNull();
  });

  it('should return to Beranda when "Kembali ke Beranda" is followed from the passed state', async () => {
    const { router } = await renderApp({
      path: PATH,
      seed: seedAccess({ assessments: [kanaExit('tes-lulus', true)] }),
    });

    await findText(PASSED_COPY);
    fireEvent.click(expectBackLink());

    await expectSettledOn(router, '/', 'Beranda');
    expect(screen.queryByRole('heading', { name: TITLE })).toBeNull();
  });

  it('should render outside the app layout, without the "Navigasi utama" landmark, once the page content is shown', async () => {
    await renderApp({ path: PATH, seed: seedAccess({ stateIds: DRILLABLE_IDS.filter((id) => id !== SO) }) });

    await findText(LOCKED_COPY);
    expect(screen.queryByRole('navigation', { name: NAV })).toBeNull();
  });

  it('should redirect /tes/jlpt to Beranda when the kind is not kana-exit', async () => {
    const { router } = await renderApp({ path: '/tes/jlpt', seed: seedAccess({}) });

    await expectSettledOn(router, '/', 'Beranda');
    expect(screen.queryByRole('heading', { level: 1, name: TITLE })).toBeNull();
  });

  it('should send /tes/kana-exit to /mulai when no profile exists', async () => {
    const { router } = await renderApp({ path: PATH });

    await expectSettledOn(router, '/mulai', 'Selamat datang');
    expect(screen.queryByRole('heading', { name: TITLE })).toBeNull();
  });
});
