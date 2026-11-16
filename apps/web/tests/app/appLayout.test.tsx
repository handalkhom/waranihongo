import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Repository, UserProfile } from '@wara/core';
import { renderApp } from '../renderApp';

const NAV = 'Navigasi utama';

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

const seedProfile = async (repository: Repository): Promise<void> => {
  await repository.saveProfile(profile());
};

const mainNavOnceLoaded = async (heading: string): Promise<HTMLElement> => {
  await screen.findByRole('heading', { name: heading });
  expect(screen.queryAllByRole('navigation', { name: NAV })).toHaveLength(1);
  return screen.getByRole('navigation', { name: NAV });
};

describe('AppLayout', () => {
  it('should show only the Beranda and Pengaturan links in the main navigation', async () => {
    await renderApp({ path: '/', seed: seedProfile });
    const nav = await mainNavOnceLoaded('Beranda');

    const links = within(nav).getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toBe(within(nav).getByRole('link', { name: 'Beranda' }));
    expect(links[1]).toBe(within(nav).getByRole('link', { name: 'Pengaturan' }));
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/', '/pengaturan']);
    expect(screen.queryByRole('link', { name: /Belajar|Jurnal|Progres/ })).toBeNull();
  });

  it("should mark the current route's link with aria-current page", async () => {
    await renderApp({ path: '/pengaturan', seed: seedProfile });
    const nav = await mainNavOnceLoaded('Pengaturan');

    expect(
      within(nav).getByRole('link', { name: 'Pengaturan' }).getAttribute('aria-current'),
    ).toBe('page');
    expect(within(nav).getByRole('link', { name: 'Beranda' }).getAttribute('aria-current')).toBeNull();
  });

  it('should move to /pengaturan when the Pengaturan link is followed', async () => {
    const { router } = await renderApp({ path: '/', seed: seedProfile });
    const nav = await mainNavOnceLoaded('Beranda');

    fireEvent.click(within(nav).getByRole('link', { name: 'Pengaturan' }));

    expect(await screen.findByRole('heading', { name: 'Pengaturan' })).toBeDefined();
    expect(router.state.location.pathname).toBe('/pengaturan');
    expect(
      within(nav).getByRole('link', { name: 'Pengaturan' }).getAttribute('aria-current'),
    ).toBe('page');
  });

  it('should show the main navigation on / and none on /mulai', async () => {
    await renderApp({ path: '/', seed: seedProfile });
    await mainNavOnceLoaded('Beranda');
    cleanup();

    await renderApp({ path: '/mulai' });
    await screen.findByRole('heading', { name: 'Selamat datang' });
    expect(screen.queryByRole('navigation', { name: NAV })).toBeNull();
  });
});
