import { Navigate, type RouteObject } from 'react-router';
import { PageLoader } from '@/components/PageLoader';
import { AppLayout } from './AppLayout';
import { OnboardingGuard } from './OnboardingGuard';
import { RouteError } from './RouteError';
import { SettingsProvider } from './SettingsProvider';

export const appRoutes: RouteObject[] = [
  {
    element: (
      <SettingsProvider>
        <OnboardingGuard />
      </SettingsProvider>
    ),
    errorElement: <RouteError />,
    hydrateFallbackElement: <PageLoader />,
    children: [
      {
        path: '/mulai',
        lazy: async () => ({ Component: (await import('@/modules/session')).OnboardingPage }),
      },
      {
        element: <AppLayout />,
        children: [
          {
            path: '/',
            lazy: async () => ({ Component: (await import('@/modules/session')).HomePage }),
          },
          {
            path: '/pengaturan',
            lazy: async () => ({ Component: (await import('@/modules/settings')).SettingsPage }),
          },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];
