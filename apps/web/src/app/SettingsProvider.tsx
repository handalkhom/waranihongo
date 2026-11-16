import { useEffect, type ReactElement, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRepository } from '@/data/repositoryContext';
import { SettingsContext } from '@/hooks/useSettings';

export function SettingsProvider({ children }: { readonly children: ReactNode }): ReactElement {
  const repository = useRepository();
  const profile = useLiveQuery(() => repository.getProfile(), [repository]);
  const theme = profile === undefined ? undefined : profile === null ? 'system' : profile.theme;

  useEffect(() => {
    if (theme === undefined) {
      return;
    }
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <SettingsContext value={profile === undefined ? { status: 'loading' } : { status: 'ready', profile }}>
      {children}
    </SettingsContext>
  );
}
