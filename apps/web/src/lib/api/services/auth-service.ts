import { useAuthStore } from '@/stores/auth-store';
import type {
  AuthResult,
  AuthUser,
  MessageResult,
  RefreshResult,
  SessionInfo,
} from '@/types/auth';
import { isApiError } from '../errors';
import { API_ENDPOINTS } from '../endpoints';
import { httpClient } from '../http-client';

/**
 * Auth domain service. Pure network operations; token persistence is wired in
 * `hooks/use-auth` and `authService.init`.
 */
export const authService = {
  async login(input: { email: string; password: string }): Promise<AuthResult> {
    const { data } = await httpClient.post<AuthResult>(
      API_ENDPOINTS.auth.login,
      input,
    );
    return data;
  },

  async register(input: {
    email: string;
    password: string;
    confirmPassword: string;
    name?: string;
  }): Promise<AuthResult> {
    const { data } = await httpClient.post<AuthResult>(
      API_ENDPOINTS.auth.register,
      input,
    );
    return data;
  },

  async me(): Promise<AuthUser> {
    const { data } = await httpClient.get<AuthUser>(API_ENDPOINTS.auth.me);
    return data;
  },

  async logout(): Promise<void> {
    await httpClient.post<void>(API_ENDPOINTS.auth.logout);
  },

  /**
   * Refresh a token pair. Bypasses the interceptor refresh flow to avoid
   * recursion and never retries (the refresh endpoint is the recovery path).
   */
  async refresh(refreshToken: string): Promise<RefreshResult> {
    const { data } = await httpClient.post<RefreshResult>(
      API_ENDPOINTS.auth.refresh,
      { refreshToken },
      { bypassRefresh: true, retries: 0 },
    );
    return data;
  },

  async verifyEmail(token: string): Promise<MessageResult> {
    const { data } = await httpClient.post<MessageResult>(
      API_ENDPOINTS.auth.verifyEmail,
      { token },
    );
    return data;
  },

  async resendVerification(email: string): Promise<MessageResult> {
    const { data } = await httpClient.post<MessageResult>(
      API_ENDPOINTS.auth.resendVerification,
      { email },
    );
    return data;
  },

  async forgotPassword(email: string): Promise<MessageResult> {
    const { data } = await httpClient.post<MessageResult>(
      API_ENDPOINTS.auth.forgotPassword,
      { email },
    );
    return data;
  },

  async resetPassword(input: {
    token: string;
    password: string;
    confirmPassword: string;
  }): Promise<MessageResult> {
    const { data } = await httpClient.post<MessageResult>(
      API_ENDPOINTS.auth.resetPassword,
      input,
    );
    return data;
  },

  async listSessions(): Promise<SessionInfo[]> {
    const { data } = await httpClient.get<SessionInfo[]>(
      API_ENDPOINTS.auth.sessions,
    );
    return data;
  },

  async revokeSession(id: string): Promise<void> {
    await httpClient.delete<void>(API_ENDPOINTS.auth.session(id));
  },

  async exchangeGoogle(code: string): Promise<AuthResult> {
    const { data } = await httpClient.post<AuthResult>(
      API_ENDPOINTS.auth.googleExchange,
      { code },
    );
    return data;
  },

  /**
   * Bootstrap the auth state on app load: if a stored access token exists,
   * revalidate the profile via `/auth/me` (the client refreshes on 401). The
   * session is cleared only when the refresh flow proves the token is dead.
   */
  async init(): Promise<void> {
    const store = useAuthStore.getState();
    if (store.accessToken === null) {
      store.syncStatus();
      return;
    }
    try {
      const user = await this.me();
      store.setUser(user);
    } catch (error) {
      if (isApiError(error) && error.code === 'AUTH_REQUIRED') {
        store.clear();
        return;
      }
      store.syncStatus();
    }
  },
};
