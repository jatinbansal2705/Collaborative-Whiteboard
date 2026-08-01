import { SetMetadata } from '@nestjs/common';
import type { BoardMemberRole } from '../../generated/prisma/client';

export const BOARD_ACCESS_KEY = 'boardAccess';

export interface BoardAccessOptions {
  minRole: BoardMemberRole;
  ownerOnly?: boolean;
}

export const BoardAccess = (options: BoardAccessOptions): MethodDecorator =>
  SetMetadata(BOARD_ACCESS_KEY, options);
