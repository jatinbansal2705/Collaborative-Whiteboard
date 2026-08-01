import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { BOARD_ROLE_RANK } from '../board.constants';
import {
  BOARD_ACCESS_KEY,
  type BoardAccessOptions,
} from '../board-access.decorator';
import { boardAccessDenied, boardNotFound } from '../board.errors';
import { MemberRepository } from '../member.repository';
import { unauthorized } from '../../auth/auth.errors';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type';

@Injectable()
export class BoardAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly memberRepository: MemberRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<
      BoardAccessOptions | undefined
    >(BOARD_ACCESS_KEY, [context.getHandler(), context.getClass()]);

    if (options === undefined) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser | undefined;
    if (user === undefined) {
      throw unauthorized();
    }

    const boardId = this.extractBoardId(request);
    if (boardId === undefined) {
      throw new BadRequestException({
        code: 'BOARD_NOT_FOUND',
        message: 'Board id must be provided',
      });
    }

    const membership = await this.memberRepository.findMembership(
      boardId,
      user.id,
    );
    if (membership === null) {
      throw boardNotFound();
    }

    const requiredRank = BOARD_ROLE_RANK[options.minRole];
    const userRank = BOARD_ROLE_RANK[membership.role];

    if (userRank < requiredRank) {
      throw boardAccessDenied();
    }

    if (options.ownerOnly === true && membership.role !== 'OWNER') {
      throw boardAccessDenied();
    }

    request.boardMembership = membership;
    return true;
  }

  private extractBoardId(request: Request): string | undefined {
    const params = request.params as Record<string, string | undefined>;
    return params.boardId ?? params.id;
  }
}
