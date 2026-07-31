import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

declare global {
  namespace Express {
    interface Request {
      id: string;
      user?: AuthenticatedUser;
    }
  }
}

export {};
