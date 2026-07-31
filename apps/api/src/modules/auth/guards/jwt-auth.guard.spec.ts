import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TokenService } from '../auth-token.service';
import { AUTH_ERROR_CODES } from '../auth.errors';

describe('JwtAuthGuard', () => {
  const buildGuard = (isPublic: boolean, verifyAccessToken: jest.Mock) => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(isPublic),
    };
    const tokenService = {
      verifyAccessToken,
    };
    const guard = new JwtAuthGuard(
      reflector as never,
      tokenService as unknown as TokenService,
    );
    return guard;
  };

  const buildContext = (headers: Record<string, string | undefined>) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
    }) as never;

  it('allows public routes without a token', async () => {
    const guard = buildGuard(true, jest.fn());

    await expect(guard.canActivate(buildContext({}))).resolves.toBe(true);
  });

  it('throws UNAUTHORIZED when no Bearer token is present', async () => {
    const guard = buildGuard(false, jest.fn());

    await expect(guard.canActivate(buildContext({}))).rejects.toMatchObject({
      response: { code: AUTH_ERROR_CODES.UNAUTHORIZED },
    });
  });

  it('throws UNAUTHORIZED when the scheme is not Bearer', async () => {
    const guard = buildGuard(false, jest.fn());

    await expect(
      guard.canActivate(buildContext({ authorization: 'Basic abc' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an invalid token', async () => {
    const verifyAccessToken = jest
      .fn()
      .mockRejectedValue(
        new UnauthorizedException({ code: 'INVALID_ACCESS_TOKEN' }),
      );
    const guard = buildGuard(false, verifyAccessToken);

    await expect(
      guard.canActivate(
        buildContext({ authorization: 'Bearer bad.token.here' }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('sets request.user from a valid token', async () => {
    const verifyAccessToken = jest.fn().mockResolvedValue({
      userId: 'user-1',
      email: 'alice@example.com',
      role: 'USER',
      sessionId: 'session-1',
    });
    const guard = buildGuard(false, verifyAccessToken);
    const request = { headers: { authorization: 'Bearer valid.token' } };
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    } as never;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request).toMatchObject({
      user: {
        id: 'user-1',
        email: 'alice@example.com',
        role: 'USER',
        sessionId: 'session-1',
      },
    });
  });
});
