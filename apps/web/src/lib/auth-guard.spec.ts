import { describe, expect, it } from 'vitest';
import {
  DASHBOARD_PATH,
  getSafeRedirectPath,
  resolveAuthPageGate,
  resolveDashboardGate,
} from '@/lib/auth-guard';

describe('getSafeRedirectPath', () => {
  it('falls back to the dashboard for missing or empty targets', () => {
    expect(getSafeRedirectPath(null)).toBe(DASHBOARD_PATH);
    expect(getSafeRedirectPath(undefined)).toBe(DASHBOARD_PATH);
    expect(getSafeRedirectPath('')).toBe(DASHBOARD_PATH);
    expect(getSafeRedirectPath('   ')).toBe(DASHBOARD_PATH);
  });

  it('accepts an internal absolute path', () => {
    expect(getSafeRedirectPath('/boards')).toBe('/boards');
    expect(getSafeRedirectPath('/')).toBe('/');
  });

  it('rejects open-redirect style targets', () => {
    expect(getSafeRedirectPath('https://evil.example')).toBe(DASHBOARD_PATH);
    expect(getSafeRedirectPath('//evil.example')).toBe(DASHBOARD_PATH);
    expect(getSafeRedirectPath('javascript:alert(1)')).toBe(DASHBOARD_PATH);
    expect(getSafeRedirectPath('\\evil.example')).toBe(DASHBOARD_PATH);
    expect(getSafeRedirectPath('\\/evil.example')).toBe(DASHBOARD_PATH);
  });
});

describe('resolveDashboardGate', () => {
  it('waits while hydration or auth revalidation is pending', () => {
    expect(resolveDashboardGate('idle', true)).toBe('loading');
    expect(resolveDashboardGate('authenticated', false)).toBe('loading');
    expect(resolveDashboardGate('unauthenticated', false)).toBe('loading');
  });

  it('renders for an authenticated session', () => {
    expect(resolveDashboardGate('authenticated', true)).toBe('render');
  });

  it('redirects guests to the login page', () => {
    expect(resolveDashboardGate('unauthenticated', true)).toBe('redirect');
  });
});

describe('resolveAuthPageGate', () => {
  it('waits while hydration or auth revalidation is pending', () => {
    expect(resolveAuthPageGate('idle', true)).toBe('loading');
    expect(resolveAuthPageGate('authenticated', false)).toBe('loading');
  });

  it('renders guest pages for unauthenticated visitors', () => {
    expect(resolveAuthPageGate('unauthenticated', true)).toBe('render');
  });

  it('redirects authenticated visitors away from auth pages', () => {
    expect(resolveAuthPageGate('authenticated', true)).toBe('redirect');
  });
});
