import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { BoardAccessGuard } from './board-access.guard';
import { BOARD_ERROR_CODES } from '../board.errors';

describe('BoardAccessGuard', () => {
  const buildGuard = (
    metadata:
      | {
          minRole: 'OWNER' | 'EDITOR' | 'COMMENTER' | 'VIEWER';
          ownerOnly?: boolean;
        }
      | undefined,
    membership: { role: string } | null,
  ) => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(metadata),
    };
    const memberRepository = {
      findMembership: jest.fn().mockResolvedValue(membership),
    };
    const guard = new BoardAccessGuard(
      reflector as never,
      memberRepository as never,
    );
    return { guard, memberRepository };
  };

  const buildContext = (user: unknown, params: Record<string, string> = {}) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user, params }),
      }),
    }) as never;

  it('passes any request when no board access metadata is present', async () => {
    const { guard } = buildGuard(undefined, null);
    await expect(guard.canActivate(buildContext(undefined))).resolves.toBe(
      true,
    );
  });

  it('rejects requests without an authenticated user', async () => {
    const { guard } = buildGuard({ minRole: 'VIEWER' }, null);
    await expect(guard.canActivate(buildContext(undefined))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects requests without a board id param', async () => {
    const { guard } = buildGuard({ minRole: 'VIEWER' }, null);
    await expect(
      guard.canActivate(buildContext({ id: 'user-1' }, { someOther: 'value' })),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects non-members with board not found', async () => {
    const { guard } = buildGuard({ minRole: 'VIEWER' }, null);
    await expect(
      guard.canActivate(buildContext({ id: 'user-1' }, { id: 'board-1' })),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: BOARD_ERROR_CODES.BOARD_NOT_FOUND },
    });
  });

  it.each([
    ['VIEWER required, VIEWER passes', 'VIEWER', 'VIEWER', false],
    ['VIEWER required, OWNER passes', 'VIEWER', 'OWNER', false],
    ['COMMENTER required, VIEWER blocked', 'COMMENTER', 'VIEWER', true],
    ['COMMENTER required, COMMENTER passes', 'COMMENTER', 'COMMENTER', false],
    ['EDITOR required, COMMENTER blocked', 'EDITOR', 'COMMENTER', true],
    ['EDITOR required, EDITOR passes', 'EDITOR', 'EDITOR', false],
    ['OWNER required, EDITOR blocked', 'OWNER', 'EDITOR', true],
    ['OWNER required, OWNER passes', 'OWNER', 'OWNER', false],
  ])('%s', async (_name, minRole, role, shouldThrow) => {
    const { guard } = buildGuard(
      { minRole: minRole as 'OWNER' | 'EDITOR' | 'COMMENTER' | 'VIEWER' },
      { role },
    );

    if (shouldThrow) {
      await expect(
        guard.canActivate(buildContext({ id: 'user-1' }, { id: 'board-1' })),
      ).rejects.toMatchObject({
        status: 403,
        response: { code: BOARD_ERROR_CODES.BOARD_ACCESS_DENIED },
      });
    } else {
      await expect(
        guard.canActivate(buildContext({ id: 'user-1' }, { id: 'board-1' })),
      ).resolves.toBe(true);
    }
  });

  it('blocks non-owners when ownerOnly is set', async () => {
    const { guard } = buildGuard(
      { minRole: 'OWNER', ownerOnly: true },
      { role: 'EDITOR' },
    );
    await expect(
      guard.canActivate(buildContext({ id: 'user-1' }, { id: 'board-1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('attaches the membership to the request on success', async () => {
    const { guard } = buildGuard({ minRole: 'VIEWER' }, { role: 'EDITOR' });
    const request = {
      user: { id: 'user-1' },
      params: { id: 'board-1' },
    } as unknown as import('express').Request;
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    } as never;

    await guard.canActivate(context);
    expect(request.boardMembership).toEqual({ role: 'EDITOR' });
  });

  it('reads boardId from a nested member route', async () => {
    const { memberRepository, guard } = buildGuard(
      { minRole: 'EDITOR' },
      { role: 'EDITOR' },
    );
    await guard.canActivate(
      buildContext({ id: 'user-1' }, { id: 'board-1', userId: 'user-2' }),
    );
    expect(memberRepository.findMembership).toHaveBeenCalledWith(
      'board-1',
      'user-1',
    );
  });
});
