import { cleanup, render } from '@testing-library/react';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { onTestFinished } from 'vitest';
import type { Repository } from '@wara/core';
import { AppProviders } from '@/app/AppProviders';
import { appRoutes } from '@/app/router';
import { WaraDb } from '@/data/db';
import { createDexieRepository } from '@/data/dexieRepository';

export interface RenderedApp {
  readonly repository: Repository;
  readonly db: WaraDb;
  readonly router: ReturnType<typeof createMemoryRouter>;
}

export const renderApp = async ({
  path = '/',
  seed,
  beforeRender,
}: {
  readonly path?: string;
  readonly seed?: (repository: Repository) => Promise<void>;
  readonly beforeRender?: (db: WaraDb) => void | Promise<void>;
} = {}): Promise<RenderedApp> => {
  const db = new WaraDb(`wara-test-${crypto.randomUUID()}`, {
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
  const repository = createDexieRepository(db, () => new Date());
  onTestFinished(() => {
    cleanup();
    db.close();
    delete document.documentElement.dataset.theme;
  });
  if (seed) {
    await seed(repository);
  }
  if (beforeRender) {
    await beforeRender(db);
  }
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(
    <AppProviders repository={repository}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { repository, db, router };
};
