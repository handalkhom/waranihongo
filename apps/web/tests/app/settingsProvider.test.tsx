import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Theme, UserProfile } from '@wara/core';
import { renderApp } from '../renderApp';

const profileWith = (theme: Theme): UserProfile => ({
  id: 'me',
  name: 'Handal',
  dailyTargetMin: 30,
  romajiAid: 'on-demand',
  theme,
  ttsVoiceUri: null,
  startDate: '2026-11-13',
  weakSeeds: [],
});

describe('SettingsProvider', () => {
  it('should set data-theme to system when no profile exists', async () => {
    await renderApp({ path: '/mulai' });

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('system');
    });
  });

  it("should set data-theme to the profile's theme when the profile is dark", async () => {
    await renderApp({
      seed: async (repository) => {
        await repository.saveProfile(profileWith('dark'));
      },
    });

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('dark');
    });
  });

  it("should set data-theme to the profile's theme when the profile is light", async () => {
    await renderApp({
      seed: async (repository) => {
        await repository.saveProfile(profileWith('light'));
      },
    });

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('light');
    });
  });

  it('should follow a saved theme change without a reload', async () => {
    const profile = profileWith('light');
    const { repository } = await renderApp({
      seed: async (seeded) => {
        await seeded.saveProfile(profile);
      },
    });
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('light');
    });

    await repository.saveProfile({ ...profile, theme: 'dark' });

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('dark');
    });
  });
});
