import { beforeEach, describe, expect, it } from 'vitest';
import {
  selectAuthStatus,
  selectIsAuthenticated,
  selectUser,
  useAuthStore,
} from '@/stores/auth-store';
import type { AuthUser } from '@/types/auth';

const user: AuthUser = {
  id: 'user-1',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  role: 'USER',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function resetStore(): void {
  useAuthStore.setState({
    accessToken: null,
    refreshToken: null,
    user: null,
    status: 'unauthenticated',
  });
}

beforeEach(() => {
  resetStore();
});

describe('auth store', () => {
  it('starts unauthenticated', () => {
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();
    expect(selectAuthStatus(state)).toBe('unauthenticated');
    expect(selectIsAuthenticated(state)).toBe(false);
  });

  it('setAuth persists the session and flips status to authenticated', () => {
    useAuthStore.getState().setAuth({
      accessToken: 'at-1',
      refreshToken: 'rt-1',
      user,
    });

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('at-1');
    expect(state.refreshToken).toBe('rt-1');
    expect(selectUser(state)).toEqual(user);
    expect(selectAuthStatus(state)).toBe('authenticated');
    expect(selectIsAuthenticated(state)).toBe(true);
  });

  it('setTokens rotates tokens while keeping the profile', () => {
    useAuthStore.getState().setAuth({
      accessToken: 'at-1',
      refreshToken: 'rt-1',
      user,
    });
    useAuthStore.getState().setTokens({
      accessToken: 'at-2',
      refreshToken: 'rt-2',
    });

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('at-2');
    expect(state.refreshToken).toBe('rt-2');
    expect(selectUser(state)).toEqual(user);
    expect(selectAuthStatus(state)).toBe('authenticated');
  });

  it('setUser updates the profile and marks the session authenticated', () => {
    useAuthStore.getState().setUser({ ...user, name: 'Ada G.' });

    expect(selectUser(useAuthStore.getState())?.name).toBe('Ada G.');
    expect(selectAuthStatus(useAuthStore.getState())).toBe('authenticated');
  });

  it('clear wipes tokens and profile and returns to unauthenticated', () => {
    useAuthStore.getState().setAuth({
      accessToken: 'at-1',
      refreshToken: 'rt-1',
      user,
    });
    useAuthStore.getState().clear();

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();
    expect(selectAuthStatus(state)).toBe('unauthenticated');
    expect(selectIsAuthenticated(state)).toBe(false);
  });

  it('syncStatus derives status from the stored access token', () => {
    useAuthStore.setState({ accessToken: 'at-1', refreshToken: 'rt-1' });
    useAuthStore.getState().syncStatus();
    expect(selectAuthStatus(useAuthStore.getState())).toBe('authenticated');

    useAuthStore.setState({ accessToken: null, refreshToken: null });
    useAuthStore.getState().syncStatus();
    expect(selectAuthStatus(useAuthStore.getState())).toBe('unauthenticated');
  });
});
