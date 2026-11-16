import type { ReactElement } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { PageLoader } from '@/components/PageLoader';
import { useSettings } from '@/hooks/useSettings';

const ONBOARDING_PATH = '/mulai';

export function OnboardingGuard(): ReactElement {
  const settings = useSettings();
  const { pathname } = useLocation();

  if (settings.status === 'loading') {
    return <PageLoader />;
  }
  const onOnboarding = pathname === ONBOARDING_PATH;
  if (settings.profile === null && !onOnboarding) {
    return <Navigate to={ONBOARDING_PATH} replace />;
  }
  if (settings.profile !== null && onOnboarding) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
