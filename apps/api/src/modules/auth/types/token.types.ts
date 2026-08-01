import type { UserRole } from '../../../generated/prisma/client';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  sid: string;
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  fam: string;
  typ: 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  sessionId: string;
}
