import type { ReactElement, ReactNode } from 'react';
import type { Repository } from '@wara/core';
import { RepositoryContext } from '@/data/repositoryContext';

export function AppProviders({
  repository,
  children,
}: {
  readonly repository: Repository;
  readonly children: ReactNode;
}): ReactElement {
  return <RepositoryContext value={repository}>{children}</RepositoryContext>;
}
