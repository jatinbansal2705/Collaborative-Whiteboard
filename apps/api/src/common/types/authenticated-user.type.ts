import type { UserRole } from '../../generated/prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  sessionId: string;
}
