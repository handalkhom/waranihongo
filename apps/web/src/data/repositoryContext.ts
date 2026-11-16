import { createContext, use } from 'react';
import { RepositoryError, type Repository } from '@wara/core';

export const RepositoryContext = createContext<Repository | null>(null);

export const useRepository = (): Repository => {
  const repository = use(RepositoryContext);
  if (repository === null) {
    throw new RepositoryError({ operation: 'useRepository', ids: [], cause: null });
  }
  return repository;
};
