import type { ReactElement, ReactNode } from 'react';
import { SessionContext } from './useSession';
import { useSessionRunner } from './useSessionRunner';

export function SessionProvider({ children }: { readonly children: ReactNode }): ReactElement {
  return <SessionContext value={useSessionRunner()}>{children}</SessionContext>;
}
