import { createContext, use } from 'react';
import type { UserProfile } from '@wara/core';

export type SettingsState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly profile: UserProfile | null };

export const SettingsContext = createContext<SettingsState>({ status: 'loading' });

export const useSettings = (): SettingsState => use(SettingsContext);
