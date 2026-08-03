export type UserRole = 'USER' | 'ADMIN';

/** User profile returned by `GET /auth/me` (ISO strings after JSON serialization). */
export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  emailVerifiedAt?: string;
  avatarUrl?: string;
  createdAt: string;
}

/** `POST /auth/register|login|google/exchange` */
export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
}

/** `POST /auth/refresh` */
export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Generic message result returned by password/verification flows. */
export interface MessageResult {
  message: string;
}

/** An active refresh-token session (from `GET /auth/sessions`). */
export interface SessionInfo {
  id: string;
  device?: string;
  ip?: string;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt: string;
}
