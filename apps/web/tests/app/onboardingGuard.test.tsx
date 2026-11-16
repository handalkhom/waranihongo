import { act, cleanup, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { UserProfile } from '@wara/core';
import { renderApp, type RenderedApp } from '../renderApp';

const WAIT = { timeout: 3000 };

const PAGE_HEADINGS = ['Selamat datang', 'Beranda', 'Pengaturan'] as const;

const profile = (): UserProfile => ({
  id: 'me',
  name: 'Handal',
  dailyTargetMin: 30,
  romajiAid: 'on-demand',
  theme: 'system',
  ttsVoiceUri: null,
  startDate: '2026-11-13',
  weakSeeds: [],
});

const expectSettledOn = async (
  router: RenderedApp['router'],
  pathname: string,
  heading: (typeof PAGE_HEADINGS)[number],
): Promise<void> => {
  await waitFor(() => {
    expect(router.state.location.pathname).toBe(pathname);
  }, WAIT);
  await screen.findByRole('heading', { level: 1, name: heading }, WAIT);
  expect(router.state.location.pathname).toBe(pathname);
  for (const other of PAGE_HEADINGS.filter((name) => name !== heading)) {
    expect(screen.queryByRole('heading', { name: other })).toBeNull();
  }
};

describe('OnboardingGuard', () => {
  it.each(['/', '/pengaturan', '/tidak-ada'])(
    'should send %s to /mulai with the onboarding heading when no profile exists',
    async (path) => {
      const { router } = await renderApp({ path });

      await expectSettledOn(router, '/mulai', 'Selamat datang');
    },
  );

  it('should send /mulai to / when a profile exists while /pengaturan stays and an unknown path ends at /', async () => {
    const seed = async (repository: RenderedApp['repository']): Promise<void> => {
      await repository.saveProfile(profile());
    };

    const fromOnboarding = await renderApp({ path: '/mulai', seed });
    await expectSettledOn(fromOnboarding.router, '/', 'Beranda');
    cleanup();

    const fromSettings = await renderApp({ path: '/pengaturan', seed });
    await expectSettledOn(fromSettings.router, '/pengaturan', 'Pengaturan');
    cleanup();

    const fromUnknown = await renderApp({ path: '/tidak-ada', seed });
    await expectSettledOn(fromUnknown.router, '/', 'Beranda');
  });

  it('should move from /mulai to / without navigation when the profile is saved while onboarding is shown', async () => {
    const { repository, router } = await renderApp({ path: '/mulai' });
    await screen.findByRole('heading', { level: 1, name: 'Selamat datang' }, WAIT);

    await act(async () => {
      await repository.saveProfile(profile());
    });

    await expectSettledOn(router, '/', 'Beranda');
  });
});
