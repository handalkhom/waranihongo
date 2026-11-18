import type { ReactElement } from 'react';
import { PageLoader } from '@/components/PageLoader';
import { OnboardingProfileStep } from './OnboardingProfileStep';
import { PlacementTest } from './PlacementTest';
import { useOnboarding, type Onboarding, type OnboardingStep } from './useOnboarding';
import { WeakSeedStep } from './WeakSeedStep';

const renderStep = (
  onboarding: Onboarding,
  step: Exclude<OnboardingStep, { readonly kind: 'loading' }>,
): ReactElement => {
  switch (step.kind) {
    case 'profile':
      return <OnboardingProfileStep onStart={onboarding.start} />;
    case 'test':
      return (
        <PlacementTest
          item={step.item}
          position={step.position}
          total={step.total}
          failedAttempts={step.failedAttempts}
          kana={onboarding.kana}
          onAnswer={(answer) => {
            void onboarding.answer(answer);
          }}
          onSkip={onboarding.skip}
        />
      );
    case 'finish':
      return (
        <WeakSeedStep
          seedChoices={step.seedChoices}
          saving={step.saving}
          onSave={(choice) => {
            void onboarding.save(choice);
          }}
        />
      );
    default:
      return step satisfies never;
  }
};

export function OnboardingPage(): ReactElement {
  const onboarding = useOnboarding();
  if (onboarding.step.kind === 'loading') return <PageLoader />;
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-6 px-4 py-8">
      {renderStep(onboarding, onboarding.step)}
    </main>
  );
}
