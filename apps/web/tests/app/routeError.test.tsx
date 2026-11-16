import { screen, waitFor } from '@testing-library/react';
import Dexie from 'dexie';
import { describe, expect, it, onTestFinished, vi, type MockInstance } from 'vitest';
import type { UserProfile } from '@wara/core';
import type { WaraDb } from '@/data/db';
import { renderApp, type RenderedApp } from '../renderApp';

const WAIT = { timeout: 3000 };

const PAGE_HEADINGS = ['Selamat datang', 'Beranda', 'Pengaturan'] as const;

const seedProfile = async (repository: RenderedApp['repository']): Promise<void> => {
  const profile: UserProfile = {
    id: 'me',
    name: 'Handal',
    dailyTargetMin: 30,
    romajiAid: 'on-demand',
    theme: 'system',
    ttsVoiceUri: null,
    startDate: '2026-11-13',
    weakSeeds: [],
  };
  await repository.saveProfile(profile);
};

const failProfileReads = (db: WaraDb): void => {
  db.profile.hook('reading', () => {
    throw new Dexie.UnknownError('gagal baca');
  });
};

const silenceConsoleError = (): MockInstance<typeof console.error> => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  onTestFinished(() => {
    spy.mockRestore();
  });
  return spy;
};

const isUnknownError = (value: unknown): boolean =>
  value instanceof Error && value.name === 'UnknownError';

const stringify = (value: unknown): string => {
  const seen = new WeakSet<object>();
  return JSON.stringify([value], (_key: string, inner: unknown): unknown => {
    if (typeof inner !== 'object' || inner === null) {
      return inner;
    }
    if (seen.has(inner)) {
      return '[circular]';
    }
    seen.add(inner);
    return inner instanceof Error
      ? { ...Object.fromEntries(Object.entries(inner)), name: inner.name, message: inner.message, stack: inner.stack }
      : inner;
  });
};

const expectErrorHeading = async (): Promise<void> => {
  await waitFor(() => {
    expect(screen.queryByRole('heading', { level: 1, name: 'Terjadi kesalahan' })).not.toBeNull();
  }, WAIT);
};

describe('RouteError', () => {
  it('should show Terjadi kesalahan with a reload button when the profile cannot be read', async () => {
    silenceConsoleError();
    await renderApp({ path: '/', seed: seedProfile, beforeRender: failProfileReads });

    await expectErrorHeading();
    expect(screen.getByText('Halaman ini gagal dimuat. Muat ulang untuk mencoba lagi.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Muat ulang' })).toBeTruthy();
  });

  it('should show no page and no navigation when the profile cannot be read', async () => {
    silenceConsoleError();
    await renderApp({ path: '/pengaturan', seed: seedProfile, beforeRender: failProfileReads });

    await expectErrorHeading();
    for (const heading of PAGE_HEADINGS) {
      expect(screen.queryByRole('heading', { name: heading })).toBeNull();
    }
    expect(screen.queryByRole('navigation', { name: 'Navigasi utama' })).toBeNull();
  });

  it('should log the error without learner data when the profile cannot be read', async () => {
    const consoleError = silenceConsoleError();
    await renderApp({ path: '/', seed: seedProfile, beforeRender: failProfileReads });

    await expectErrorHeading();
    const loggedArguments = consoleError.mock.calls.flat();
    expect(loggedArguments.some(isUnknownError)).toBe(true);
    for (const argument of loggedArguments) {
      expect(stringify(argument)).not.toContain('Handal');
    }
  });
});
