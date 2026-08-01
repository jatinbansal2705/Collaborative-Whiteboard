import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import type { BoardMember } from '../generated/prisma/client';

declare global {
  namespace Express {
    interface Request {
      id: string;
      user?: AuthenticatedUser;
      boardMembership?: BoardMember;
    }
  }
}

export {};
