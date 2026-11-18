import { createContext, use, type Context } from 'react';
import type { SessionRunner } from './useSessionRunner';

const loadingRunner: SessionRunner = {
  step: { kind: 'loading' },
  progress: null,
  kana: [],
  answer: () => Promise.resolve(),
  finishIntro: () => undefined,
  finishContrast: () => undefined,
};

export const SessionContext: Context<SessionRunner> = createContext<SessionRunner>(loadingRunner);

export const useSession = (): SessionRunner => use(SessionContext);
