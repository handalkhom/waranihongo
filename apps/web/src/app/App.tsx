import type { ReactElement } from 'react';

export function App(): ReactElement {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-2 px-4">
      <h1 lang="ja" className="text-2xl font-semibold">
        ワラの日本語
      </h1>
      <p className="text-sm text-muted-foreground">Sedang dibangun.</p>
    </main>
  );
}
