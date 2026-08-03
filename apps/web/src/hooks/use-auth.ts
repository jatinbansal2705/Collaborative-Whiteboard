'use client';

import { useCallback } from 'react';
import { authService } from '@/lib/api/services/auth-service';
import type { LoginInput, RegisterInput } from '@/lib/validators/auth';
import type { AuthUser } from '@/types/auth';
import {
  selectAuthStatus,
  selectIsAuthenticated,
  selectUser,
  useAuthStore,
  type AuthStatus,
} from '@/stores/auth-store';

export interface UseAuthResult {
  user: AuthUser | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

/**
 * Auth facade: wires the auth service to the persisted session store.
 * Components only call these actions or read the selectors.
 */
export function useAuth(): UseAuthResult {
  const user = useAuthStore(selectUser);
  const status = useAuthStore(selectAuthStatus);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);

  const login = useCallback(async (input: LoginInput): Promise<AuthUser> => {
    const result = await authService.login(input);
    useAuthStore.getState().setAuth(result);
    return result.user;
  }, []);

  const register = useCallback(
    async (input: RegisterInput): Promise<AuthUser> => {
      const result = await authService.register(input);
      useAuthStore.getState().setAuth(result);
      return result.user;
    },
    [],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authService.logout();
    } finally {
      useAuthStore.getState().clear();
    }
  }, []);

  return { user, status, isAuthenticated, login, register, logout };
}
