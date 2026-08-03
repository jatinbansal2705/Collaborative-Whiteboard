import type { AuthStatus } from '@/stores/auth-store';

export const DASHBOARD_PATH = '/';
export const LOGIN_PATH = '/login';

export type AuthGate = 'loading' | 'render' | 'redirect';

/**
 * Sanitize an inbound `?next=` target so it can only be an internal path,
 * preventing open redirects (see ADR-0011 for the OAuth analogue).
 */
export function getSafeRedirectPath(next: string | null | undefined): string {
  if (next === null || next === undefined) {
    return DASHBOARD_PATH;
  }
  const candidate = next.trim();
  if (candidate.length === 0) {
    return DASHBOARD_PATH;
  }
  if (!candidate.startsWith('/')) {
    return DASHBOARD_PATH;
  }
  if (candidate.startsWith('//')) {
    return DASHBOARD_PATH;
  }
  if (candidate.includes('\\')) {
    return DASHBOARD_PATH;
  }
  if (/^\/[^/]*:/.test(candidate)) {
    return DASHBOARD_PATH;
  }
  return candidate;
}

/**
 * Gate for protected routes (e.g. the dashboard): wait for hydration + auth
 * revalidation, then either render or send the visitor to the login page.
 */
export function resolveDashboardGate(
  status: AuthStatus,
  hydrated: boolean,
): AuthGate {
  if (!hydrated || status === 'idle') {
    return 'loading';
  }
  return status === 'authenticated' ? 'render' : 'redirect';
}

/**
 * Gate for guest pages (e.g. the auth forms): wait for hydration + auth
 * revalidation, then either render or send an authenticated visitor home.
 */
export function resolveAuthPageGate(
  status: AuthStatus,
  hydrated: boolean,
): AuthGate {
  if (!hydrated || status === 'idle') {
    return 'loading';
  }
  return status === 'authenticated' ? 'redirect' : 'render';
}
