import type { ReactElement } from 'react';
import { TYPOGRAPHY } from '@/lib/typography';

export function OnboardingPage(): ReactElement {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-2 px-4">
      <h1 className={TYPOGRAPHY.pageTitle}>Selamat datang</h1>
      <p className="text-sm text-muted-foreground">Onboarding sedang dibangun.</p>
    </main>
  );
}
