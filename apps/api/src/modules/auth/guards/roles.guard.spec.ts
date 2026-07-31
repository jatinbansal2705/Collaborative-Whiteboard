import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const buildGuard = (metadata: string[]) => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(metadata),
    };
    const guard = new RolesGuard(reflector as never);
    return guard;
  };

  const buildContext = (user: unknown) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as never;

  it.each([
    ['USER required, USER role passes', ['USER'], { role: 'USER' }, false],
    ['ADMIN required, ADMIN role passes', ['ADMIN'], { role: 'ADMIN' }, false],
    ['USER required, ADMIN role passes', ['USER'], { role: 'ADMIN' }, false],
    ['ADMIN required, USER role blocked', ['ADMIN'], { role: 'USER' }, true],
    ['ADMIN required, missing user blocked', ['ADMIN'], undefined, true],
  ])('%s', (_name, roles, user, shouldThrow) => {
    const guard = buildGuard(roles);

    if (shouldThrow) {
      expect(() => guard.canActivate(buildContext(user))).toThrow(
        ForbiddenException,
      );
    } else {
      expect(guard.canActivate(buildContext(user))).toBe(true);
    }
  });

  it('passes any request when no roles are required', () => {
    const guard = buildGuard([]);
    expect(guard.canActivate(buildContext(undefined))).toBe(true);
  });
});
