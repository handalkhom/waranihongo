import { useState, type ReactElement } from 'react';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { WaraDb } from '@/data/db';
import { createDexieRepository } from '@/data/dexieRepository';
import { AppProviders } from './AppProviders';
import { appRoutes } from './router';

export function App(): ReactElement {
  const [repository] = useState(() => createDexieRepository(new WaraDb('wara-no-nihongo'), () => new Date()));
  const [router] = useState(() => createBrowserRouter(appRoutes));
  return (
    <AppProviders repository={repository}>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
