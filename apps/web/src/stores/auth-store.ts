import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AuthUser } from '@/types/auth';

export type AuthStatus = 'idle' | 'authenticated' | 'unauthenticated';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  status: AuthStatus;
  setAuth: (auth: {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
  }) => void;
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
  setUser: (user: AuthUser) => void;
  clear: () => void;
  syncStatus: () => void;
}

/**
 * Auth session store. Persists tokens + user in localStorage; `status` is
 * derived at rehydration and never persisted.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      status: 'idle',
      setAuth: ({ accessToken, refreshToken, user }) =>
        set({ accessToken, refreshToken, user, status: 'authenticated' }),
      setTokens: ({ accessToken, refreshToken }) =>
        set({ accessToken, refreshToken, status: 'authenticated' }),
      setUser: (user) => set({ user, status: 'authenticated' }),
      clear: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          status: 'unauthenticated',
        }),
      syncStatus: () =>
        set((state) => ({
          status:
            state.accessToken !== null ? 'authenticated' : 'unauthenticated',
        })),
    }),
    {
      name: 'whiteboard-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        state?.syncStatus();
      },
    },
  ),
);

export const selectAccessToken = (state: AuthState): string | null =>
  state.accessToken;
export const selectRefreshToken = (state: AuthState): string | null =>
  state.refreshToken;
export const selectUser = (state: AuthState): AuthUser | null => state.user;
export const selectIsAuthenticated = (state: AuthState): boolean =>
  state.status === 'authenticated';
export const selectAuthStatus = (state: AuthState): AuthStatus => state.status;
