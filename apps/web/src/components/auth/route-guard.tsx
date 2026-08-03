'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingState } from '@/components/state/loading-state';
import { useHydrated } from '@/hooks/use-hydrated';
import {
  getSafeRedirectPath,
  LOGIN_PATH,
  resolveAuthPageGate,
  resolveDashboardGate,
} from '@/lib/auth-guard';
import { selectAuthStatus, useAuthStore } from '@/stores/auth-store';

interface RouteGuardProps {
  children: React.ReactNode;
}

/**
 * Requires an authenticated session. Renders a loader while the persisted
 * session is hydrated/revalidated, then redirects unauthenticated visitors to
 * `/login` (honouring a sanitized `?next=` target).
 */
export function RequireAuth({ children }: RouteGuardProps) {
  const router = useRouter();
  const hydrated = useHydrated();
  const status = useAuthStore(selectAuthStatus);

  useEffect(() => {
    if (resolveDashboardGate(status, hydrated) !== 'redirect') {
      return;
    }
    const next =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('next')
        : null;
    router.replace(
      `${LOGIN_PATH}?next=${encodeURIComponent(getSafeRedirectPath(next))}`,
    );
  }, [status, hydrated, router]);

  const gate = resolveDashboardGate(status, hydrated);

  if (gate !== 'render') {
    return <LoadingState label="Loading your workspace…" className="m-auto" />;
  }

  return <>{children}</>;
}

/**
 * Guest-page guard for the auth routes: sends already-authenticated visitors
 * back to the dashboard.
 */
export function RedirectAuthenticated({ children }: RouteGuardProps) {
  const router = useRouter();
  const hydrated = useHydrated();
  const status = useAuthStore(selectAuthStatus);

  useEffect(() => {
    if (resolveAuthPageGate(status, hydrated) === 'redirect') {
      router.replace('/');
    }
  }, [status, hydrated, router]);

  const gate = resolveAuthPageGate(status, hydrated);

  if (gate !== 'render') {
    return <LoadingState label="Loading…" className="m-auto" />;
  }

  return <>{children}</>;
}
