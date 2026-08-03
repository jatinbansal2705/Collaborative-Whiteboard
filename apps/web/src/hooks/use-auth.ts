'use client';

import { useCallback } from 'react';
import { authService } from '@/lib/api/services/auth-service';
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from '@/lib/validators/auth';
import type { AuthUser, MessageResult } from '@/types/auth';
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
  verifyEmail: (token: string) => Promise<MessageResult>;
  resendVerification: (email: string) => Promise<MessageResult>;
  forgotPassword: (input: ForgotPasswordInput) => Promise<MessageResult>;
  resetPassword: (input: ResetPasswordInput) => Promise<MessageResult>;
  signInWithGoogle: (code: string) => Promise<AuthUser>;
  clearSession: () => void;
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

  const verifyEmail = useCallback(
    (token: string): Promise<MessageResult> => authService.verifyEmail(token),
    [],
  );

  const resendVerification = useCallback(
    (email: string): Promise<MessageResult> =>
      authService.resendVerification(email),
    [],
  );

  const forgotPassword = useCallback(
    (input: ForgotPasswordInput): Promise<MessageResult> =>
      authService.forgotPassword(input.email),
    [],
  );

  const resetPassword = useCallback(
    (input: ResetPasswordInput): Promise<MessageResult> =>
      authService.resetPassword(input),
    [],
  );

  const signInWithGoogle = useCallback(
    async (code: string): Promise<AuthUser> => {
      const result = await authService.exchangeGoogle(code);
      useAuthStore.getState().setAuth(result);
      return result.user;
    },
    [],
  );

  const clearSession = useCallback((): void => {
    useAuthStore.getState().clear();
  }, []);

  return {
    user,
    status,
    isAuthenticated,
    login,
    register,
    logout,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
    signInWithGoogle,
    clearSession,
  };
}
