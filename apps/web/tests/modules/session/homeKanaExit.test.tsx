import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { contentBundle } from '@wara/content';
import type { KanaExitAssessment, Repository, ReviewState, UserProfile } from '@wara/core';
import { renderApp } from '../../renderApp';

const WAIT = { timeout: 3000 };
const DAY_MS = 24 * 60 * 60 * 1000;

const CARD_HEADING = 'Tes keluar Fase 0';
const CARD_LINK = 'Mulai tes';
const NE = 'kana:hira:ね';
const UNDRILLABLE: ReadonlyArray<string> = ['kana:hira:っ', 'kana:kata:ッ', 'kana:kata:ー'];

const DRILLABLE_KANA: ReadonlyArray<string> = contentBundle.items.flatMap((item) =>
  item.type === 'kana' && item.data.romaji !== '' && item.supersededBy === undefined ? [item.id] : [],
);

const ALL_KANA: ReadonlyArray<string> = contentBundle.items.flatMap((item) => (item.type === 'kana' ? [item.id] : []));

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

const stated = (itemId: string): ReviewState => {
  const due = new Date(Date.now() + 10 * DAY_MS);
  return {
    itemId,
    stability: 12,
    difficulty: 5,
    due,
    lastReview: new Date(due.getTime() - 12 * DAY_MS),
    reps: 3,
    lapses: 0,
    learningSteps: 0,
    state: 'review',
  };
};

const attempt = (id: string, passed: boolean): KanaExitAssessment => ({
  id,
  date: '2026-11-20',
  kind: 'kana-exit',
  passed,
  correct: passed ? 50 : 41,
  total: 50,
  elapsedMs: passed ? 280_000 : 310_000,
  wrong: passed ? [] : ['kana:hira:ね', 'kana:hira:れ'],
});

const seedHome =
  ({
    reviewed,
    assessments = [],
  }: {
    readonly reviewed: ReadonlyArray<string>;
    readonly assessments?: ReadonlyArray<KanaExitAssessment>;
  }) =>
  async (repository: Repository): Promise<void> => {
    await repository.saveProfile(profile);
    await repository.commitReview(reviewed.map(stated), []);
    for (const assessment of assessments) {
      await repository.saveAssessment(assessment);
    }
  };

const waitForHome = async (): Promise<void> => {
  await screen.findByRole('heading', { level: 1, name: 'Beranda' }, WAIT);
  await screen.findByRole('link', { name: 'Mulai sesi hari ini' }, WAIT);
};

const findCard = async (): Promise<void> => {
  await screen.findByRole('heading', { level: 2, name: CARD_HEADING }, WAIT);
  expect(screen.getByRole('link', { name: CARD_LINK }).getAttribute('href')).toBe('/tes/kana-exit');
};

const expectNoCard = (): void => {
  expect(screen.queryByRole('heading', { name: CARD_HEADING })).toBeNull();
  expect(screen.queryByRole('link', { name: CARD_LINK })).toBeNull();
};

const expectRestOfHome = (): void => {
  expect(screen.getByRole('heading', { level: 1, name: 'Beranda' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Mulai sesi hari ini' }).getAttribute('href')).toBe('/sesi');
};

describe('HomePage kana-exit card', () => {
  it('should show the "Tes keluar Fase 0" card with a "Mulai tes" link to /tes/kana-exit when every kana has a state and there is no assessment', async () => {
    await renderApp({ seed: seedHome({ reviewed: ALL_KANA }) });

    await waitForHome();
    await findCard();
    expectRestOfHome();
  });

  it('should show the card when っ, ッ and ー have no state but every drillable kana does', async () => {
    for (const id of UNDRILLABLE) {
      expect(ALL_KANA).toContain(id);
      expect(DRILLABLE_KANA).not.toContain(id);
    }
    const { repository } = await renderApp({ seed: seedHome({ reviewed: DRILLABLE_KANA }) });

    await waitForHome();
    await findCard();
    expect(await repository.getReviewStates(UNDRILLABLE)).toEqual([]);
    expectRestOfHome();
  });

  it('should hide the card when one drillable kana (ね) has no state', async () => {
    expect(DRILLABLE_KANA).toContain(NE);
    await renderApp({ seed: seedHome({ reviewed: DRILLABLE_KANA.filter((id) => id !== NE) }) });

    await waitForHome();
    expectNoCard();
  });

  it('should show the card once the last unreviewed drillable kana (ね) gets a state after render', async () => {
    const { repository } = await renderApp({ seed: seedHome({ reviewed: DRILLABLE_KANA.filter((id) => id !== NE) }) });

    await waitForHome();
    expectNoCard();

    await repository.commitReview([stated(NE)], []);

    await findCard();
    expectRestOfHome();
  });

  it('should hide the card when a passed kana-exit assessment exists and every kana has a state', async () => {
    await renderApp({
      seed: seedHome({ reviewed: ALL_KANA, assessments: [attempt('a-gagal', false), attempt('a-lulus', true)] }),
    });

    await waitForHome();
    expectNoCard();
  });

  it('should remove the card for good when a passed kana-exit assessment is saved after render', async () => {
    const { repository } = await renderApp({ seed: seedHome({ reviewed: ALL_KANA }) });

    await waitForHome();
    await findCard();

    await repository.saveAssessment(attempt('a-lulus', true));

    await waitFor(() => {
      expectNoCard();
    }, WAIT);
    expectRestOfHome();
  });

  it('should keep the card for a retake when only a failed kana-exit assessment exists', async () => {
    await renderApp({ seed: seedHome({ reviewed: ALL_KANA, assessments: [attempt('a-gagal', false)] }) });

    await waitForHome();
    await findCard();
    expectRestOfHome();
  });

  it('should navigate to /tes/kana-exit and leave Beranda when "Mulai tes" is followed', async () => {
    const { router } = await renderApp({ seed: seedHome({ reviewed: ALL_KANA }) });

    await waitForHome();
    await findCard();
    fireEvent.click(screen.getByRole('link', { name: CARD_LINK }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/tes/kana-exit');
    }, WAIT);
    await waitFor(() => {
      expect(screen.queryByRole('heading', { level: 1, name: 'Beranda' })).toBeNull();
    }, WAIT);
  });
});
